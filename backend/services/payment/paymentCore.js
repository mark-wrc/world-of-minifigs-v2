import Order from "../../models/order.model.js";
import OrderDraft from "../../models/orderDraft.model.js";
import User from "../../models/user.model.js";
import { ORDER_STATUSES, ORDER_TYPES } from "../../constants/orderConstants.js";
import sendEmail from "../../utils/sendEmail.js";
import { getAdminNewOrderTemplate } from "../../utils/Email/orderEmails.js";
import { getShippingCountry } from "../../../shared/shippingData.js";

// ------------------------- Draft Management (Scalability) -------------------------

/**
 * Saves a temporary snapshot of the order before redirecting to the gateway.
 * Prevents metadata character limit issues and cart drift.
 */
export async function saveOrderDraft(userId, orderType, payload) {
  // Clean up any existing draft for this user and type to avoid duplicates
  await OrderDraft.findOneAndDelete({ userId, orderType });

  const draft = await OrderDraft.create({ userId, orderType, payload });
  return draft._id.toString();
}

/**
 * Atomically retrieves and deletes the draft in a single DB operation.
 * Guarantees only one caller (confirmOrder or webhook) processes it.
 */
export async function getDraftAndClean(draftId) {
  if (!draftId) return null;
  return await OrderDraft.findByIdAndDelete(draftId);
}

// ------------------------- Order Lookup ----------------------------

// Finds an order by the reference its checkout returned. Orders from before
// the neutral field existed only carry the Stripe one.
export const findOrderByCheckoutRef = (ref) =>
  Order.findOne({
    $or: [
      { "payment.checkoutSessionId": ref },
      { "payment.stripeSessionId": ref },
    ],
  });

// ------------------------- Shipping Country Guard ----------------------------

// Square's hosted checkout can't restrict the address country, so compare what
// the buyer entered with the destination they paid shipping for.
const getShippingCountryMismatch = (expected, actual) => {
  if (!expected || !actual) return undefined;
  if (expected.toUpperCase() === actual.toUpperCase()) return undefined;
  return { expected: expected.toUpperCase(), actual: actual.toUpperCase() };
};

const sendShippingCountryMismatchEmail = (order, adminEmail) => {
  const { expected, actual } = order.payment.shippingCountryMismatch;
  const label = (code) => getShippingCountry(code)?.label || code;
  const orderRef = String(order._id).substring(0, 7).toUpperCase();

  return sendEmail({
    email: adminEmail,
    subject: `Review before shipping - destination mismatch on order ${orderRef}`,
    message: `<p>Order <strong>${orderRef}</strong> paid shipping to <strong>${label(expected)}</strong>, but the buyer entered a shipping address in <strong>${label(actual)}</strong> on the ${order.payment.gateway} checkout page.</p>
<p>Order ID: ${order._id}<br>Total paid: $${order.payment.totalAmount.toFixed(2)}</p>
<p>The shipping fee charged may not cover this destination. Please review the order before shipping it.</p>`,
  });
};

// ------------------------- Shared: Create Order Record ----------------------------

// `payment` is the normalized payment result every gateway produces
// (see services/payment/gateways).
export async function createOrderRecord(
  payment,
  {
    orderType = ORDER_TYPES.PRODUCT,
    items,
    extraFields = {},
    shippingInsurance = 0,
  },
) {
  // 1. Prevent duplicate orders from same checkout
  const existingOrder = await findOrderByCheckoutRef(payment.sessionId);
  if (existingOrder) return { order: existingOrder, created: false };

  const { userId, totals, shippingAddress, billing, discount } = payment;
  const shippingCountryMismatch = getShippingCountryMismatch(
    payment.metadata?.shippingCountry,
    shippingAddress?.country,
  );

  // 2. Construct Order Data
  const orderData = {
    userId,
    email: payment.email || undefined,
    orderType,
    ...extraFields,
    payment: {
      gateway: payment.gateway,
      subtotal:
        Math.round((totals.subtotal - (shippingInsurance || 0)) * 100) / 100,
      shippingFee: totals.shippingFee,
      shippingInsurance: shippingInsurance || 0,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      paidAt: new Date(),
      checkoutSessionId: payment.sessionId,
      gatewayOrderId: payment.gatewayOrderId,
      transactionId: payment.transactionId,
      receiptNumber: payment.receiptNumber,
      receiptUrl: payment.receiptUrl || undefined,
      ...payment.legacyPaymentFields,
      ...(discount && { discount }),
      ...(shippingCountryMismatch && { shippingCountryMismatch }),
    },
    status: ORDER_STATUSES.PAID,
    ...(shippingAddress && { shipping: { address: shippingAddress } }),
    ...(billing && { billing }),
  };

  // 3. Assign items to the correct polymorphic database field.
  // Wholesale orders reuse the dealer item shape — same documents, same stock.
  if (
    orderType === ORDER_TYPES.DEALER ||
    orderType === ORDER_TYPES.WHOLESALE
  ) {
    orderData.dealerItems = items;
  } else if (orderType === ORDER_TYPES.REWARD) {
    orderData.rewardItems = items;
  } else {
    orderData.productItems = items;
  }

  const order = await Order.create(orderData);

  const adminEmail = process.env.SMTP_FROM_EMAIL;
  if (adminEmail) {
    User.findById(userId, "firstName lastName email")
      .then((user) => {
        const customerName = user
          ? `${user.firstName} ${user.lastName}`.trim() || user.email
          : order.email;
        return sendEmail({
          email: adminEmail,
          subject: `New Order Received - ${process.env.SMTP_FROM_NAME || "World of Minifigs"}`,
          message: getAdminNewOrderTemplate(order, customerName),
        });
      })
      .catch((err) =>
        console.error("Admin new order email failed:", err.message),
      );

    if (shippingCountryMismatch) {
      sendShippingCountryMismatchEmail(order, adminEmail).catch((err) =>
        console.error("Shipping mismatch email failed:", err.message),
      );
    }
  }

  return { order, created: true };
}
