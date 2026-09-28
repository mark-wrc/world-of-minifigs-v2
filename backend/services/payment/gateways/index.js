import { PAYMENT_GATEWAYS } from "../../../constants/orderConstants.js";
import stripeGateway from "./stripeGateway.js";
import squareGateway from "./squareGateway.js";

// Every gateway adapter exposes the same surface: isConfigured, createCheckout,
// fetchPaidSession, createRefund, fetchRefund — each returning gateway-neutral
// shapes, so order, stock and email code never branch on the provider.
const ADAPTERS = {
  [PAYMENT_GATEWAYS.STRIPE]: stripeGateway,
  [PAYMENT_GATEWAYS.SQUARE]: squareGateway,
};

export const getGateway = (name) => ADAPTERS[name] || null;

// Orders placed before Square support carry no gateway — they are Stripe.
export const getOrderGateway = (order) =>
  getGateway(order?.payment?.gateway || PAYMENT_GATEWAYS.STRIPE);

// Gateways offered to buyers: listed in ENABLED_PAYMENT_GATEWAYS (Stripe only
// when unset) and actually configured, so a half-set-up gateway stays hidden.
export const getEnabledGateways = () => {
  const listed = (process.env.ENABLED_PAYMENT_GATEWAYS || PAYMENT_GATEWAYS.STRIPE)
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(listed)].filter((name) => ADAPTERS[name]?.isConfigured());
};

export const isGatewayEnabled = (name) => getEnabledGateways().includes(name);

export const getDefaultGateway = () => {
  const enabled = getEnabledGateways();
  return enabled.includes(PAYMENT_GATEWAYS.STRIPE)
    ? PAYMENT_GATEWAYS.STRIPE
    : enabled[0] || PAYMENT_GATEWAYS.STRIPE;
};
