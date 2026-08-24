import {
  ORDER_STATUSES,
  REFUND_STATUSES,
  VALID_STATUS_TRANSITIONS,
  CANCELLATION_REASONS,
} from "../constants/orderConstants.js";
import { getStripe } from "../utils/stripe.js";
import { restockOrder } from "../utils/payment/index.js";

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
  if (order.status === ORDER_STATUSES.PAID) return null;

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

export const acquireCancellationLock = async (order) => {
  if (order.cancellation.isLocked) {
    const lockExpired =
      order.cancellation.lockExpiresAt &&
      order.cancellation.lockExpiresAt < new Date();

    if (!lockExpired) {
      return buildErrorResponse(
        409,
        "Cancellation already in progress",
        "A cancellation request is already being processed. Please wait.",
      );
    }
  }

  order.cancellation.isLocked = true;
  order.cancellation.lockExpiresAt = new Date(Date.now() + LOCK_DURATION_MS);
  await order.save();
  return null;
};

export const releaseCancellationLock = async (order) => {
  order.cancellation.isLocked = false;
  order.cancellation.lockExpiresAt = undefined;
  await order.save();
};

// ------------------------ Stripe Refund --------------------------------

export const createStripeRefundForOrder = async (order) => {
  const stripe = getStripe();
  return stripe.refunds.create(
    { payment_intent: order.payment.stripePaymentIntentId },
    { idempotencyKey: `refund_${order._id}` },
  );
};

// ------------------------ Cancellation Metadata --------------------------------

export const applyCancellationMetadata = (
  order,
  { role, cancelledById, reason, notes, stripeRefundId },
) => {
  order.status = ORDER_STATUSES.CANCELLED;
  order.refund.status = REFUND_STATUSES.PENDING;
  order.cancellation.cancelledAt = new Date();
  order.cancellation.cancelledByRole = role;
  order.cancellation.cancelledById = cancelledById;
  order.refund.initiatedAt = new Date();
  order.cancellation.reason = reason?.trim();
  order.cancellation.notes = notes?.trim() || undefined;
  order.refund.stripeRefundId = stripeRefundId;
  order.refund.amount = order.payment.totalAmount;
};

// ------------------------ Restock --------------------------------

export const restockOrderItemsSafely = async (order) => {
  try {
    await restockOrder(order);
  } catch (stockErr) {
    console.error(
      `Inventory restock failed for order ${order._id}:`,
      stockErr.message,
    );
  }
};

// ------------------------ Refund Status Sync (Fallback) --------------------------------

export const syncRefundStatus = async (order) => {
  // Only sync if refund is pending and we have a Stripe refund ID
  if (
    order.refund?.status !== REFUND_STATUSES.PENDING ||
    !order.refund?.stripeRefundId
  ) {
    return order;
  }

  try {
    const stripe = getStripe();
    const refund = await stripe.refunds.retrieve(order.refund.stripeRefundId);

    if (refund.status === "succeeded") {
      order.refund.status = REFUND_STATUSES.COMPLETED;
      order.refund.completedAt = new Date();
      order.refund.amount = refund.amount / 100;
      order.cancellation.isLocked = false;

      // Store ARN if available
      const cardDetails = refund.destination_details?.card;
      if (
        cardDetails?.reference_status === "available" &&
        cardDetails?.reference &&
        !order.refund.arn
      ) {
        order.refund.arn = cardDetails.reference;
      }

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
