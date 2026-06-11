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
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  FAILED: "failed",
};

export const REFUND_STATUSES = {
  NONE: "none",
  PENDING: "pending",
  COMPLETED: "completed",
};

export const VALID_STATUS_TRANSITIONS = {
  [ORDER_STATUSES.PAID]: [ORDER_STATUSES.SHIPPED, ORDER_STATUSES.CANCELLED],
  // Delivered status disabled per client request — "shipped" is the final status.
  // [ORDER_STATUSES.SHIPPED]: [ORDER_STATUSES.DELIVERED],
};

export const ORDER_TYPES = {
  PRODUCT: "product",
  DEALER: "dealer",
  WHOLESALE: "wholesale",
  REWARD: "reward",
};
