import Order from "../../models/order.model.js";
import OrderDraft from "../../models/orderDraft.model.js";
import User from "../../models/user.model.js";
import {
  extractShippingAddress,
  extractBillingDetails,
  extractSessionTotals,
  extractDiscountInfo,
} from "../../utils/payment/index.js";
import { ORDER_STATUSES, ORDER_TYPES } from "../../constants/orderConstants.js";
import sendEmail from "../../utils/sendEmail.js";
import { getAdminNewOrderTemplate } from "../../utils/Email/orderEmails.js";

// ------------------------- Draft Management (Scalability) -------------------------

/**
 * Saves a temporary snapshot of the order before redirecting to Stripe.
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

// ------------------------- Shared: Create Order Record ----------------------------

export async function createOrderRecord(
  session,
  { orderType = ORDER_TYPES.PRODUCT, items, extraFields = {} },
) {
  // 1. Prevent duplicate orders from same session
  const existingOrder = await Order.findOne({
    "payment.stripeSessionId": session.id,
  });
  if (existingOrder) return { order: existingOrder, created: false };

  // 2. Extract session data
  const userId = session.client_reference_id;
  const shippingAddress = extractShippingAddress(session);
  const billingDetails = extractBillingDetails(session, shippingAddress);
  const totals = extractSessionTotals(session, items);
  const discount = await extractDiscountInfo(session);

  // 3. Construct Order Data
  const orderData = {
    userId,
    email: totals.email || undefined,
    orderType,
    ...extraFields,
    payment: {
      subtotal: totals.subtotal,
      shippingFee: totals.shippingFee,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      paidAt: new Date(),
      stripeSessionId: session.id,
      stripePaymentIntentId:
        session.payment_intent?.id || session.payment_intent,
      stripeInvoiceNumber: session.invoice?.number,
      invoiceUrl: session.invoice?.hosted_invoice_url || undefined,
      ...(discount && { discount }),
    },
    status: ORDER_STATUSES.PAID,
    ...(shippingAddress && { shipping: { address: shippingAddress } }),
    ...(billingDetails && { billing: billingDetails }),
  };

  // 4. Assign items to the correct polymorphic database field
  if (orderType === ORDER_TYPES.DEALER) {
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
  }

  return { order, created: true };
}
