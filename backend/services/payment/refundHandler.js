import Order from "../../models/order.model.js";
import {
  ORDER_STATUSES,
  PAYMENT_GATEWAYS,
  REFUND_STATUSES,
} from "../../constants/orderConstants.js";
import { REFUND_ENTRY_STATUSES } from "../../../shared/orderLines.js";
import { applyShipmentRefund } from "../shipmentService.js";

// ------------ Refunds Made Without Cancelling (order.refunds) ------------

// Brings one order.refunds entry up to date with the gateway's refund.
// Returns whether anything changed.
export function applyRefundEntryUpdate(entry, refund) {
  if (entry.status === REFUND_ENTRY_STATUSES.COMPLETED) return false;
  if (refund.completed) {
    entry.status = REFUND_ENTRY_STATUSES.COMPLETED;
    entry.completedAt = new Date();
    entry.amount = refund.amount;
    return true;
  }
  if (refund.failed && entry.status !== REFUND_ENTRY_STATUSES.FAILED) {
    entry.status = REFUND_ENTRY_STATUSES.FAILED;
    entry.error = "The payment provider reported this refund as failed.";
    return true;
  }
  return false;
}

// A refund the order view made, or one made in the Stripe/Square dashboard on
// an order that isn't being cancelled. Returns true when it was handled here.
async function applyOrderRefundEntry(refund) {
  const withEntry = await Order.findOne({ "refunds.gatewayRefundId": refund.id });
  if (withEntry) {
    const entry = withEntry.refunds.find((r) => r.gatewayRefundId === refund.id);
    if (applyRefundEntryUpdate(entry, refund)) await withEntry.save();
    return true;
  }

  const order = await Order.findOne({
    $or: [
      { "payment.transactionId": refund.transactionId },
      { "payment.stripePaymentIntentId": refund.transactionId },
    ],
  });
  // Cancelled (or being cancelled) orders: the cancel refund, handled below as before.
  if (
    !order ||
    order.status === ORDER_STATUSES.CANCELLED ||
    order.cancellation?.isLocked
  ) {
    return false;
  }

  // Our own refund whose id isn't saved yet (the webhook beat the order view's
  // save): the order view saves its entry as pending before asking the gateway.
  const waiting = (order.refunds || []).find(
    (r) =>
      r.source === "admin" &&
      !r.gatewayRefundId &&
      r.status === REFUND_ENTRY_STATUSES.PENDING &&
      Math.abs(r.amount - refund.amount) < 0.005,
  );
  if (waiting) {
    waiting.gatewayRefundId = refund.id;
    applyRefundEntryUpdate(waiting, refund);
    await order.save();
    return true;
  }

  if (refund.failed) return true;
  order.refunds = order.refunds || [];
  order.refunds.push({
    amount: refund.amount,
    reason: "Refunded in the payment provider's dashboard",
    source: "gateway",
    gatewayRefundId: refund.id,
    status: refund.completed
      ? REFUND_ENTRY_STATUSES.COMPLETED
      : REFUND_ENTRY_STATUSES.PENDING,
    ...(refund.completed && { completedAt: new Date() }),
  });
  await order.save();
  return true;
}

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
  // A refund from the order view that failed: mark it, so it stops counting.
  if (refund.failed && refund.id) {
    const order = await Order.findOne({ "refunds.gatewayRefundId": refund.id });
    const entry = order?.refunds.find((r) => r.gatewayRefundId === refund.id);
    if (entry && applyRefundEntryUpdate(entry, refund)) await order.save();
  }
  if (refund.failed) {
    console.error(
      `Refund ${refund.id} failed for payment ${refund.transactionId}`,
    );
    return;
  }
  if (!refund.completed || !refund.transactionId) return;

  // A shipping refund can share its payment with an order (the order that
  // paid a consolidated shipment's fee), so match shipments by refund id first.
  if (await applyShipmentRefund(refund)) return;

  // Refunds that aren't a cancellation go on the order's refund list instead of
  // being taken for the cancel refund.
  if (await applyOrderRefundEntry(refund)) return;

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
