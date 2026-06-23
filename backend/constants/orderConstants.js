export const CANCELLATION_REASONS = [
  "Changed my mind",
  "Ordered by mistake",
  "Found a better price elsewhere",
  "Shipping cost is too high",
  "Incorrect shipping information",
  "Item no longer needed",
  "Other",
];

export const ORDER_STATUSES = {
  PAID: "paid",
  SHIPPED: "shipped",
  CANCELLED: "cancelled",
  FAILED: "failed",
};

export const REFUND_STATUSES = {
  NONE: "none",
  PENDING: "pending",
  COMPLETED: "completed",
};

export const VALID_STATUS_TRANSITIONS = {
  // "shipped" is the final status — no transition beyond it.
  [ORDER_STATUSES.PAID]: [ORDER_STATUSES.SHIPPED, ORDER_STATUSES.CANCELLED],
};

export const ORDER_TYPES = {
  PRODUCT: "product",
  DEALER: "dealer",
  WHOLESALE: "wholesale",
  REWARD: "reward",
};
