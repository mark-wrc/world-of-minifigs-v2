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

// How a "delivered" order reached the customer. Courier shipments are never
// marked delivered — the carrier's tracking link already tells that story.
export const DELIVERY_METHODS = {
  HAND_DELIVERED: "hand_delivered",
  STORE_PICKUP: "store_pickup",
};

export const DELIVERY_METHOD_LABELS = {
  [DELIVERY_METHODS.HAND_DELIVERED]: "Hand Delivered",
  [DELIVERY_METHODS.STORE_PICKUP]: "Pick-up in Store",
};

export const REFUND_STATUSES = {
  NONE: "none",
  PENDING: "pending",
  COMPLETED: "completed",
};

export const VALID_STATUS_TRANSITIONS = {
  // "shipped", "delivered" and "cancelled" are all final — no transition
  // beyond them. A shipped order deliberately has no "delivered" step: the
  // customer follows the carrier's tracking link instead of waiting on us.
  [ORDER_STATUSES.PAID]: [
    ORDER_STATUSES.SHIPPED,
    ORDER_STATUSES.DELIVERED,
    ORDER_STATUSES.CANCELLED,
  ],
};

export const ORDER_TYPES = {
  PRODUCT: "product",
  DEALER: "dealer",
  WHOLESALE: "wholesale",
  REWARD: "reward",
};
