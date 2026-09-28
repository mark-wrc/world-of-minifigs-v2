import { WebhooksHelper } from "square";
import { getSquare } from "../../../utils/square.js";
import { PAYMENT_GATEWAYS } from "../../../constants/orderConstants.js";
import { resolveShippingCountry } from "../../../../shared/shippingData.js";
import { FRONTEND_URL } from "../paymentConfig.js";

// Square money amounts are BigInt in the SDK. Never JSON.stringify a raw
// Square request/response — BigInt throws.
const CURRENCY = "USD";
const MAX_LINE_ITEM_NAME = 500;

const toMoney = (cents) => ({
  amount: BigInt(Math.round(cents)),
  currency: CURRENCY,
});

// Accepts SDK money (BigInt) and raw webhook money (number) alike.
const toDollars = (money) =>
  money?.amount != null ? Number(money.amount) / 100 : 0;

const round2 = (n) => Math.round(n * 100) / 100;

const shippingFeeName = (country) => `Shipping — ${country.label}`;

const isConfigured = () =>
  !!(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID);

const isWebhookConfigured = () =>
  !!(
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY &&
    process.env.SQUARE_WEBHOOK_NOTIFICATION_URL
  );

// Gateway-neutral line item → Square order line item. Square line items carry
// no image, and quantity is a string.
const toSquareLineItem = ({ name, unitAmountCents, quantity, description }) => ({
  name: name.slice(0, MAX_LINE_ITEM_NAME),
  quantity: String(quantity),
  basePriceMoney: toMoney(unitAmountCents),
  ...(description && { note: description }),
});

// ------------------------- Checkout --------------------------------

const createCheckout = async ({
  lineItems,
  shippingCountry,
  metadata,
  userId,
  email,
}) => {
  const country = resolveShippingCountry(shippingCountry);
  const { draftId } = metadata;

  const { paymentLink } = await getSquare().checkout.paymentLinks.create({
    // One link per draft, so a retried request can't open a second checkout.
    idempotencyKey: `link_${draftId}`,
    order: {
      locationId: process.env.SQUARE_LOCATION_ID,
      referenceId: userId.toString(),
      lineItems: lineItems.map(toSquareLineItem),
      // No `taxes` — Square orders carry no sales tax in v1 (SQUARE_PAYMENT.MD G2).
      metadata: {
        ...metadata,
        userId: userId.toString(),
        shippingCountry: country.code,
      },
    },
    checkoutOptions: {
      askForShippingAddress: true,
      // Square has no {CHECKOUT_SESSION_ID} placeholder, so our draft id is the
      // reference the success page confirms against.
      redirectUrl: `${FRONTEND_URL}/checkout/success?gateway=square&ref=${draftId}`,
      shippingFee: {
        name: shippingFeeName(country),
        charge: toMoney(country.amount),
      },
      allowTipping: false,
      // Our promo codes are Stripe coupons; Square coupons are a separate system.
      enableCoupon: true,
      enableLoyalty: false,
      ...(process.env.SQUARE_SUPPORT_EMAIL && {
        merchantSupportEmail: process.env.SQUARE_SUPPORT_EMAIL,
      }),
    },
    ...(email && { prePopulatedData: { buyerEmail: email } }),
  });

  return {
    url: paymentLink.url,
    sessionRef: draftId,
    gatewayOrderId: paymentLink.orderId,
  };
};

// ------------------------- Paid Order --------------------------------

const toShippingAddress = (recipient, fallbackAddress) => {
  const address = recipient?.address || fallbackAddress;
  if (!address?.addressLine1) {
    console.error("Square shipping address missing or incomplete");
    return undefined;
  }

  const name =
    recipient?.displayName ||
    [address.firstName, address.lastName].filter(Boolean).join(" ");

  return {
    name: name || undefined,
    line1: address.addressLine1,
    line2: address.addressLine2 || undefined,
    city: address.locality || undefined,
    state: address.administrativeDistrictLevel1 || undefined,
    postalCode: address.postalCode || undefined,
    country: address.country || undefined,
    phone: recipient?.phoneNumber || undefined,
  };
};

const toBillingDetails = (payment, shippingAddress) => {
  const card = payment.cardDetails?.card;
  const cardHolderName = card?.cardholderName || "";
  const country =
    payment.billingAddress?.country || card?.billingAddress?.country || "";
  if (!cardHolderName && !country) return undefined;

  // Skip billing when it matches shipping
  if (
    cardHolderName.toLowerCase() ===
      (shippingAddress?.name || "").toLowerCase() &&
    country.toUpperCase() === (shippingAddress?.country || "").toUpperCase()
  ) {
    return undefined;
  }

  return {
    cardHolderName: cardHolderName || undefined,
    country: country || undefined,
  };
};

// Square order → normalized payment result once its payment has COMPLETED.
// Returns null while unpaid, and for orders our checkout didn't create
// (e.g. POS sales on the same location carry no draftId).
const fetchPaidSession = async (squareOrderId) => {
  const square = getSquare();
  const { order } = await square.orders.get({ orderId: squareOrderId });
  const meta = order?.metadata || {};
  if (!meta.draftId) return null;

  const tender = order.tenders?.[0];
  const paymentId = tender?.paymentId || tender?.id;
  if (!paymentId) return null;

  const { payment } = await square.payments.get({ paymentId });
  if (payment?.status !== "COMPLETED") return null;

  const shipment = order.fulfillments?.find(
    (f) => f.shipmentDetails,
  )?.shipmentDetails;
  const shippingAddress = toShippingAddress(
    shipment?.recipient,
    payment.shippingAddress,
  );

  // Subtotal is our own line items; the shipping fee is whatever remains,
  // whether Square recorded it as a service charge or as a line item.
  const feeName = shippingFeeName(resolveShippingCountry(meta.shippingCountry));
  const totalAmount = toDollars(order.totalMoney);
  const taxAmount = toDollars(order.totalTaxMoney);
  const discountAmount = toDollars(order.totalDiscountMoney);
  const subtotal = round2(
    (order.lineItems || [])
      .filter((item) => item.name !== feeName)
      .reduce((sum, item) => sum + toDollars(item.grossSalesMoney), 0),
  );
  const shippingFee = round2(
    Math.max(0, totalAmount - subtotal - taxAmount + discountAmount),
  );

  return {
    gateway: PAYMENT_GATEWAYS.SQUARE,
    sessionId: meta.draftId,
    gatewayOrderId: order.id,
    transactionId: payment.id,
    receiptNumber: payment.receiptNumber,
    receiptUrl: payment.receiptUrl,
    userId: meta.userId || order.referenceId,
    email: payment.buyerEmailAddress || shipment?.recipient?.emailAddress,
    metadata: meta,
    totals: { subtotal, shippingFee, taxAmount, discountAmount, totalAmount },
    discount: undefined,
    shippingAddress,
    billing: toBillingDetails(payment, shippingAddress),
  };
};

// ------------------------- Webhook --------------------------------

// Verifies the HMAC signature and the environment, returns the parsed event.
const verifyWebhook = async (rawBody, headers) => {
  const requestBody = rawBody.toString("utf8");
  const isValid = await WebhooksHelper.verifySignature({
    requestBody,
    signatureHeader: headers["x-square-hmacsha256-signature"] || "",
    signatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
    notificationUrl: process.env.SQUARE_WEBHOOK_NOTIFICATION_URL,
  });
  if (!isValid) throw new Error("Invalid Square webhook signature");

  // A stale subscription from the other environment must not create orders here.
  const eventEnvironment = (headers["square-environment"] || "").toLowerCase();
  const expectedEnvironment =
    process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
  if (eventEnvironment && eventEnvironment !== expectedEnvironment) {
    throw new Error(`Square webhook environment mismatch: ${eventEnvironment}`);
  }

  return JSON.parse(requestBody);
};

// ------------------------- Refunds --------------------------------

// Square PaymentRefund → normalized refund
const normalizeRefund = (refund) => ({
  id: refund.id,
  completed: refund.status === "COMPLETED",
  failed: refund.status === "FAILED" || refund.status === "REJECTED",
  amount: toDollars(refund.amountMoney),
  transactionId: refund.paymentId,
  arn: undefined, // Square doesn't expose an ARN
});

// Webhook payloads are raw snake_case JSON, not SDK objects.
const normalizeWebhookRefund = (refund) =>
  normalizeRefund({
    id: refund.id,
    status: refund.status,
    amountMoney: refund.amount_money,
    paymentId: refund.payment_id,
  });

const createRefund = async (order) => {
  const { refund } = await getSquare().refunds.refundPayment({
    idempotencyKey: `refund_${order._id}`,
    paymentId: order.payment.transactionId,
    // Square needs an explicit amount — always the full order total.
    amountMoney: toMoney(order.payment.totalAmount * 100),
    reason: "Order cancelled",
  });
  return normalizeRefund(refund);
};

const fetchRefund = async (refundId) => {
  const { refund } = await getSquare().refunds.get({ refundId });
  return normalizeRefund(refund);
};

export default {
  name: PAYMENT_GATEWAYS.SQUARE,
  isConfigured,
  isWebhookConfigured,
  createCheckout,
  fetchPaidSession,
  verifyWebhook,
  normalizeWebhookRefund,
  createRefund,
  fetchRefund,
};
