import Order from "../../../models/order.model.js";
import User from "../../../models/user.model.js";
import { getStripe } from "../../../utils/stripe.js";
import {
  extractShippingAddress,
  extractBillingDetails,
  extractSessionTotals,
  extractDiscountInfo,
} from "../../../utils/payment/index.js";
import { PAYMENT_GATEWAYS } from "../../../constants/orderConstants.js";
import { FRONTEND_URL, buildStripeSessionConfig } from "../paymentConfig.js";

const SESSION_EXPAND = [
  "invoice",
  "total_details.breakdown.discounts",
  "discounts.coupon",
  "discounts.promotion_code",
  "discounts.promotion_code.promotion.coupon",
];

const isConfigured = () => !!process.env.STRIPE_SECRET_KEY;

// Gateway-neutral line item → Stripe price_data line item
const toStripeLineItem = ({
  name,
  unitAmountCents,
  quantity,
  imageUrl,
  description,
}) => ({
  price_data: {
    currency: "usd",
    product_data: {
      name,
      ...(description && { description }),
      ...(imageUrl && { images: [imageUrl] }),
    },
    unit_amount: unitAmountCents,
    tax_behavior: "exclusive",
  },
  quantity,
});

// ------------------------- Checkout --------------------------------

// Find existing Stripe customer or create one, caching the ID on the user
// Returns null if Stripe is unavailable (checkout falls back to customer_email)
const findOrCreateStripeCustomer = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const stripe = getStripe();

  // 1 — Try existing cached customer
  if (user.stripeCustomerId) {
    try {
      await stripe.customers.retrieve(user.stripeCustomerId);
      return user.stripeCustomerId;
    } catch {
      // Customer was deleted in Stripe — fall through to recreate
    }
  }

  // 2 — Search by email to avoid duplicates if DB save previously failed
  const existing = await stripe.customers.list({ email: user.email, limit: 1 });
  if (existing.data.length > 0) {
    const existingId = existing.data[0].id;
    await User.findByIdAndUpdate(userId, { stripeCustomerId: existingId });
    return existingId;
  }

  // 3 — Create new customer
  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    metadata: { userId: userId.toString() },
    tax_exempt: user.isTaxExempt ? "exempt" : "none",
  });

  await User.findByIdAndUpdate(userId, { stripeCustomerId: customer.id });
  return customer.id;
};

const createCheckout = async ({
  lineItems,
  shippingCountry,
  metadata,
  userId,
  email,
  cancelUrl,
}) => {
  // Try to get/create a linked Stripe customer for tax exemption support
  // Falls back to customer_email if Stripe customer API is unavailable
  let customerParam = {};
  try {
    const stripeCustomerId = await findOrCreateStripeCustomer(userId);
    customerParam = { customer: stripeCustomerId };
  } catch (customerErr) {
    console.error(
      "Stripe customer lookup failed, falling back to customer_email:",
      customerErr.message,
    );
    customerParam = { customer_email: email };
  }

  const session = await getStripe().checkout.sessions.create({
    ...buildStripeSessionConfig(shippingCountry),
    line_items: lineItems.map(toStripeLineItem),
    success_url: `${FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    client_reference_id: userId.toString(),
    ...customerParam,
    payment_intent_data: {
      receipt_email: email,
    },
    metadata,
  });

  return { url: session.url, sessionRef: session.id };
};

// ------------------------- Paid Session --------------------------------

const retrieveSession = (sessionId) =>
  getStripe().checkout.sessions.retrieve(sessionId, { expand: SESSION_EXPAND });

// Stripe Checkout Session → normalized payment result
const normalizeSession = async (session) => {
  const shippingAddress = extractShippingAddress(session);
  const totals = extractSessionTotals(session);
  const paymentIntentId = session.payment_intent?.id || session.payment_intent;
  const invoiceNumber = session.invoice?.number;
  const invoiceUrl = session.invoice?.hosted_invoice_url || undefined;

  return {
    gateway: PAYMENT_GATEWAYS.STRIPE,
    sessionId: session.id,
    transactionId: paymentIntentId,
    receiptNumber: invoiceNumber,
    receiptUrl: invoiceUrl,
    userId: session.client_reference_id,
    email: totals.email,
    metadata: session.metadata || {},
    totals,
    discount: await extractDiscountInfo(session),
    shippingAddress,
    billing: extractBillingDetails(session, shippingAddress),
    // Stripe-named fields, still written so older readers keep working.
    legacyPaymentFields: {
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      stripeInvoiceNumber: invoiceNumber,
      invoiceUrl,
    },
  };
};

// Normalized payment result, or null while the session is unpaid.
const fetchPaidSession = async (sessionId) => {
  const session = await retrieveSession(sessionId);
  if (session.payment_status !== "paid") return null;
  return normalizeSession(session);
};

// Backfills invoice number / URL onto an order if Stripe hadn't finalized the
// invoice before the webhook fired. Mutates and returns the order.
const patchReceiptFields = async (order) => {
  const { payment } = order;
  if (payment.stripeInvoiceNumber || payment.invoiceUrl) return order;

  const session = await retrieveSession(
    payment.checkoutSessionId || payment.stripeSessionId,
  );
  const invoiceNumber = session.invoice?.number;
  const invoiceUrl = session.invoice?.hosted_invoice_url;
  if (invoiceNumber || invoiceUrl) {
    await Order.findByIdAndUpdate(order._id, {
      "payment.stripeInvoiceNumber": invoiceNumber,
      "payment.invoiceUrl": invoiceUrl || undefined,
      "payment.receiptNumber": invoiceNumber,
      "payment.receiptUrl": invoiceUrl || undefined,
    });
    payment.stripeInvoiceNumber = invoiceNumber;
    payment.invoiceUrl = invoiceUrl;
    payment.receiptNumber = invoiceNumber;
    payment.receiptUrl = invoiceUrl;
  }
  return order;
};

// ------------------------- Webhook --------------------------------

const verifyWebhook = (rawBody, headers) =>
  getStripe().webhooks.constructEvent(
    rawBody,
    headers["stripe-signature"],
    process.env.STRIPE_WEBHOOK_SECRET,
  );

// ------------------------- Refunds --------------------------------

// Stripe Refund → normalized refund
const normalizeRefund = (refund) => {
  const card = refund.destination_details?.card;
  return {
    id: refund.id,
    completed: refund.status === "succeeded",
    failed: refund.status === "failed" || refund.status === "canceled",
    amount: refund.amount / 100,
    transactionId: refund.payment_intent?.id || refund.payment_intent,
    arn:
      card?.reference_status === "available" && card?.reference
        ? card.reference
        : undefined,
  };
};

const createRefund = async (order) => {
  const refund = await getStripe().refunds.create(
    {
      payment_intent:
        order.payment.transactionId || order.payment.stripePaymentIntentId,
    },
    { idempotencyKey: `refund_${order._id}` },
  );
  return normalizeRefund(refund);
};

const fetchRefund = async (refundId) =>
  normalizeRefund(await getStripe().refunds.retrieve(refundId));

export default {
  name: PAYMENT_GATEWAYS.STRIPE,
  isConfigured,
  createCheckout,
  retrieveSession,
  normalizeSession,
  fetchPaidSession,
  patchReceiptFields,
  verifyWebhook,
  normalizeRefund,
  createRefund,
  fetchRefund,
};
