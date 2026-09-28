import Order from "../../models/order.model.js";
import {
  PAYMENT_GATEWAYS,
  REFUND_STATUSES,
} from "../../constants/orderConstants.js";

// ------------ Apply a Completed Refund ------------
// `refund` is a normalized gateway refund. Mutates the order (caller saves)
// and returns whether anything changed.

export function applyCompletedRefund(order, refund) {
  if (!refund.completed) return false;
  if (order.refund.status === REFUND_STATUSES.COMPLETED) return false;

  order.refund.status = REFUND_STATUSES.COMPLETED;
  order.refund.completedAt = new Date();
  order.cancellation.isLocked = false;
  order.refund.gatewayRefundId = refund.id;
  if (order.payment.gateway !== PAYMENT_GATEWAYS.SQUARE) {
    order.refund.stripeRefundId = refund.id;
  }
  order.refund.amount = refund.amount;

  // Store ARN if available (Stripe only)
  if (refund.arn && !order.refund.arn) {
    order.refund.arn = refund.arn;
  }

  return true;
}

// ------------ Refund Webhook Handler ------------

export async function handleRefundUpdated(refund) {
  if (refund.failed) {
    console.error(
      `Refund ${refund.id} failed for payment ${refund.transactionId}`,
    );
    return;
  }
  if (!refund.completed || !refund.transactionId) return;

  const order = await Order.findOne({
    $or: [
      { "payment.transactionId": refund.transactionId },
      { "payment.stripePaymentIntentId": refund.transactionId },
    ],
  });

  if (!order) return;

  if (applyCompletedRefund(order, refund)) {
    await order.save();
  }
}
