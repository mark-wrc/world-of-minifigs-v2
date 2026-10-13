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
  // Paid, but held until the customer asks us to ship it (Pay Now, Ship Later).
  ON_HOLD: "on_hold",
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
  // A held order only becomes "paid" (ready to pack) when the customer pays to
  // ship it — never by hand. Staff can still hand it over in store or cancel it.
  [ORDER_STATUSES.ON_HOLD]: [
    ORDER_STATUSES.DELIVERED,
    ORDER_STATUSES.CANCELLED,
  ],
};

// ------------------------- Pay Now, Ship Later -------------------------

// Chosen per checkout: ship this order now (shipping charged), or hold it and
// pay one flat shipping fee later for everything held.
export const SHIPPING_MODES = {
  SHIP_NOW: "ship_now",
  HOLD: "hold",
};

export const SHIPMENT_STATUSES = {
  PAID: "paid", // shipping paid, waiting to be packed
  SHIPPED: "shipped",
  CANCELLED: "cancelled", // every order in it was cancelled before shipping
};

// Where a shipment's flat fee was paid: its own shipping-only checkout, or as
// the shipping fee of a new order checked out with "ship my held orders".
export const SHIPMENT_PAYMENT_SOURCES = {
  STANDALONE: "standalone",
  ORDER: "order",
};

// Draft / payment metadata tag for a shipping-only checkout.
export const SHIPMENT_CHECKOUT_TYPE = "shipment";

export const PAYMENT_GATEWAYS = {
  STRIPE: "stripe",
  SQUARE: "square",
};

// Orders placed before Square support carry no gateway — they are Stripe.
// Mirrors PAYMENT_GATEWAY_LABELS on the frontend.
export const PAYMENT_GATEWAY_LABELS = {
  [PAYMENT_GATEWAYS.STRIPE]: "Stripe",
  [PAYMENT_GATEWAYS.SQUARE]: "Square",
};

export const getPaymentGatewayLabel = (order) => {
  const gateway = order?.payment?.gateway || PAYMENT_GATEWAYS.STRIPE;
  return PAYMENT_GATEWAY_LABELS[gateway] || gateway;
};

export const ORDER_TYPES = {
  PRODUCT: "product",
  DEALER: "dealer",
  WHOLESALE: "wholesale",
  REWARD: "reward",
};
