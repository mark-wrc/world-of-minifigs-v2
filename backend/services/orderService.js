import {
  ORDER_STATUSES,
  REFUND_STATUSES,
  VALID_STATUS_TRANSITIONS,
  CANCELLATION_REASONS,
} from "../constants/orderConstants.js";
import Order from "../models/order.model.js";
import { restockOrder } from "../utils/payment/index.js";
import { restockOrderLines } from "../utils/payment/stockManager.js";
import {
  getOrderLines,
  getRefundedTotal,
  refundedQuantityByKey,
  awaitingQuantityByKey,
  REFUND_ENTRY_STATUSES,
} from "../../shared/orderLines.js";
import { getOrderGateway } from "./payment/gateways/index.js";
import {
  applyCompletedRefund,
  applyRefundEntryUpdate,
} from "./payment/refundHandler.js";
import {
  getCancellationRefundAmount,
  releaseShipmentIfEmpty,
} from "./shipmentService.js";

// ------------------------ Constants --------------------------------

const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ------------------------ Error Response Helper --------------------------------

export const buildErrorResponse = (status, message, description) => ({
  status,
  body: { success: false, message, description },
});

// ------------------------ Validation Helpers --------------------------------

export const validateUserCancellationRequest = (reason, notes) => {
  if (!reason) {
    return buildErrorResponse(
      400,
      "Cancellation reason is required",
      "Please select a reason for cancelling.",
    );
  }

  if (!CANCELLATION_REASONS.includes(reason)) {
    return buildErrorResponse(
      400,
      "Invalid cancellation reason",
      "Please select a valid reason from the list.",
    );
  }

  if (reason === "Other" && (!notes || !notes.trim())) {
    return buildErrorResponse(
      400,
      "Additional details required",
      'Please provide details when selecting "Other" as the reason.',
    );
  }

  return null;
};

export const ensureOrderIsUserCancellable = (order) => {
  if (
    order.status === ORDER_STATUSES.PAID ||
    order.status === ORDER_STATUSES.ON_HOLD
  ) {
    return null;
  }

  const reasonByStatus = {
    [ORDER_STATUSES.SHIPPED]:
      "This order has already been shipped and cannot be cancelled.",
    [ORDER_STATUSES.DELIVERED]:
      "This order has already been delivered and cannot be cancelled.",
  };

  return buildErrorResponse(
    400,
    "Order cannot be cancelled",
    reasonByStatus[order.status] ||
      "This order is not eligible for cancellation.",
  );
};

// ------------------------ Cancellation Locking --------------------------------

// Taken in one atomic step, so a cancel can't start while another cancel, or
// a refund from the order view (refundLockUntil), is in progress — and a
// refund can't start once this lock is held.
export const acquireCancellationLock = async (order) => {
  const now = new Date();
  const lockExpiresAt = new Date(Date.now() + LOCK_DURATION_MS);
  const locked = await Order.findOneAndUpdate(
    {
      _id: order._id,
      // Still cancellable now (another cancel may have finished meanwhile).
      status: { $in: [ORDER_STATUSES.PAID, ORDER_STATUSES.ON_HOLD] },
      $and: [
        {
          $or: [
            { "cancellation.isLocked": { $ne: true } },
            { "cancellation.lockExpiresAt": { $lt: now } },
          ],
        },
        {
          $or: [
            { refundLockUntil: { $exists: false } },
            { refundLockUntil: null },
            { refundLockUntil: { $lt: now } },
          ],
        },
      ],
    },
    {
      $set: {
        "cancellation.isLocked": true,
        "cancellation.lockExpiresAt": lockExpiresAt,
      },
    },
    { new: true, projection: { _id: 1 } },
  );

  if (!locked) {
    const current = await Order.findById(order._id).select("refundLockUntil status");
    if (current && ![ORDER_STATUSES.PAID, ORDER_STATUSES.ON_HOLD].includes(current.status)) {
      return buildErrorResponse(
        409,
        "Order already changed",
        "This order was just cancelled or shipped by someone else. Reload it to see.",
      );
    }
    if (current?.refundLockUntil && current.refundLockUntil > now) {
      return buildErrorResponse(
        409,
        "Refund in progress",
        "A refund is being made on this order right now. Wait a moment and try again.",
      );
    }
    return buildErrorResponse(
      409,
      "Cancellation already in progress",
      "A cancellation request is already being processed. Please wait.",
    );
  }

  // Keep the loaded order in step with what was saved.
  order.cancellation.isLocked = true;
  order.cancellation.lockExpiresAt = lockExpiresAt;
  return null;
};

export const releaseCancellationLock = async (order) => {
  order.cancellation.isLocked = false;
  order.cancellation.lockExpiresAt = undefined;
  await order.save();
};

// ------------------------ Gateway Refund --------------------------------

// Refunds the order through whichever gateway took the payment — in full,
// except an order whose shipping fee still covers a consolidated shipment.
// Refunds already made from the order view (order.refunds) are taken off, so
// only what's left is refunded. Orders without them are unchanged.
// Refunds are read fresh here: the cancellation lock is held, so none can be
// added meanwhile. A refund still pending at the provider must finish first —
// if it later failed, the cancel would have refunded too little.
export const createRefundForOrder = async (order) => {
  const amount = await getCancellationRefundAmount(order);
  const fresh = await Order.findById(order._id);
  const isPending = (r) => r.status === REFUND_ENTRY_STATUSES.PENDING;
  if (fresh?.refunds?.some(isPending)) await syncRefundEntries(fresh);
  if (fresh?.refunds?.some(isPending)) {
    const err = new Error("A refund on this order is still being processed.");
    err.description =
      "An earlier refund on this order is still being processed by the payment provider. Try cancelling again once it has gone through (usually within a few minutes).";
    throw err;
  }
  const alreadyRefunded = getRefundedTotal(fresh);
  if (alreadyRefunded > 0) {
    const left =
      Math.round(((amount ?? order.payment.totalAmount) - alreadyRefunded) * 100) / 100;
    if (left <= 0) {
      throw new Error("Nothing left to refund: this order was already refunded in full.");
    }
    return getOrderGateway(order).createRefund(order, { amount: left });
  }
  return getOrderGateway(order).createRefund(order, { amount });
};

// Once an order in a consolidated shipment is cancelled, the shipment may
// have nothing left to ship — then its shipping fee is refunded too.
export const releaseOrderShipmentSafely = async (order) => {
  try {
    await releaseShipmentIfEmpty(order);
  } catch (err) {
    console.error(
      `Releasing shipment for cancelled order ${order._id} failed:`,
      err.message,
    );
  }
};

// ------------------------ Cancellation Metadata --------------------------------

export const applyCancellationMetadata = (
  order,
  { role, cancelledById, reason, notes, refundId, refundAmount },
) => {
  order.status = ORDER_STATUSES.CANCELLED;
  order.refund.status = REFUND_STATUSES.PENDING;
  order.cancellation.cancelledAt = new Date();
  order.cancellation.cancelledByRole = role;
  order.cancellation.cancelledById = cancelledById;
  order.refund.initiatedAt = new Date();
  order.cancellation.reason = reason?.trim();
  order.cancellation.notes = notes?.trim() || undefined;
  order.refund.gatewayRefundId = refundId;
  if (order.payment.gateway !== "square") {
    order.refund.stripeRefundId = refundId;
  }
  order.refund.amount = refundAmount ?? order.payment.totalAmount;
};

// ------------------------ Restock --------------------------------

// Items already refunded from the order view were put back (or held back) by
// that refund, and backordered items never came in, so a cancel only restocks
// the rest. Orders with neither are unchanged.
export const restockOrderItemsSafely = async (order) => {
  try {
    const fresh = (await Order.findById(order._id).select("refunds backorders")) || order;
    const refunded = refundedQuantityByKey(fresh);
    const waiting = awaitingQuantityByKey(fresh);
    if (Object.keys(refunded).length || Object.keys(waiting).length) {
      await restockOrderLines(
        order,
        getOrderLines(order).map((l) => ({
          lineKey: l.key,
          quantity: Math.max(0, l.quantity - (refunded[l.key] || 0) - (waiting[l.key] || 0)),
        })),
      );
      return;
    }
    await restockOrder(order);
  } catch (stockErr) {
    console.error(
      `Inventory restock failed for order ${order._id}:`,
      stockErr.message,
    );
  }
};

// ------------------------ Refund Status Sync (Fallback) --------------------------------

// Refunds made without cancelling (order.refunds) that are still pending.
// One saved as pending but never given the provider's id (the server stopped
// mid-refund, or the provider call timed out) is looked up on the payment once
// its refund lock has expired: matched by amount if the provider has it,
// otherwise marked failed (no money moved).
const STUCK_AFTER_MS = 2 * 60 * 1000;
const syncRefundEntries = async (order) => {
  const stuck = (order.refunds || []).filter(
    (r) =>
      r.status === REFUND_ENTRY_STATUSES.PENDING &&
      !r.gatewayRefundId &&
      Date.now() - new Date(r.createdAt).getTime() > STUCK_AFTER_MS,
  );
  let changed = false;
  if (stuck.length) {
    try {
      const known = new Set(
        [
          order.refund?.gatewayRefundId,
          ...(order.refunds || []).map((r) => r.gatewayRefundId),
        ].filter(Boolean),
      );
      const atProvider = await getOrderGateway(order).listRefunds(order);
      for (const entry of stuck) {
        const match = atProvider.find(
          (x) => !known.has(x.id) && !x.failed && Math.abs(x.amount - entry.amount) < 0.005,
        );
        if (match) {
          known.add(match.id);
          entry.gatewayRefundId = match.id;
          applyRefundEntryUpdate(entry, match);
          entry.error =
            "This refund was interrupted after the money moved: its backorder and stock changes were not made. Check them by hand.";
        } else {
          entry.status = REFUND_ENTRY_STATUSES.FAILED;
          entry.error = "The payment provider has no record of this refund, so no money moved.";
        }
        changed = true;
      }
    } catch (err) {
      console.error(
        `syncRefundEntries: Failed to look up stuck refunds for order ${order._id}:`,
        err.message,
      );
    }
  }
  const pending = (order.refunds || []).filter(
    (r) => r.status === REFUND_ENTRY_STATUSES.PENDING && r.gatewayRefundId,
  );
  if (!pending.length) {
    if (changed) await order.save();
    return;
  }
  for (const entry of pending) {
    try {
      const refund = await getOrderGateway(order).fetchRefund(entry.gatewayRefundId);
      if (applyRefundEntryUpdate(entry, refund)) changed = true;
    } catch (err) {
      console.error(
        `syncRefundEntries: Failed to sync refund ${entry.gatewayRefundId} for order ${order._id}:`,
        err.message,
      );
    }
  }
  if (changed) await order.save();
};

export const syncRefundStatus = async (order) => {
  await syncRefundEntries(order);
  // Only sync if refund is pending and we have a gateway refund ID
  const refundId = order.refund?.gatewayRefundId || order.refund?.stripeRefundId;
  if (order.refund?.status !== REFUND_STATUSES.PENDING || !refundId) {
    return order;
  }

  try {
    const refund = await getOrderGateway(order).fetchRefund(refundId);

    if (applyCompletedRefund(order, refund)) {
      await order.save();
    }
  } catch (err) {
    console.error(
      `syncRefundStatus: Failed to sync refund for order ${order._id}:`,
      err.message,
    );
  }

  return order;
};

// ------------------------ Response Builder --------------------------------

export const buildCancellationSuccessResponse = (
  order,
  message,
  description,
) => ({
  success: true,
  message,
  description,
  order: {
    _id: order._id,
    status: order.status,
    refund: order.refund,
    cancellation: order.cancellation,
  },
});

// ------------------------ Status Transition Validation --------------------------------

export const validateStatusTransition = (currentStatus, newStatus) => {
  const allowedNext = VALID_STATUS_TRANSITIONS[currentStatus];
  if (!allowedNext || !allowedNext.includes(newStatus)) {
    return buildErrorResponse(
      400,
      "Invalid status transition",
      `Cannot change status from "${currentStatus}" to "${newStatus}".`,
    );
  }
  return null;
};
