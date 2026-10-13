import { resolveShippingCountry } from "../../../shared/shippingData.js";

// ------------------------- Constants --------------------------------

export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Options shared by every destination. Shipping and the allowed address country
// are layered on per-destination by buildStripeSessionConfig.
const BASE_SESSION_CONFIG = {
  mode: "payment",
  automatic_tax: { enabled: true },
  invoice_creation: { enabled: true },
  phone_number_collection: { enabled: true },
  allow_promotion_codes: true,
  customer_update: {
    shipping: "auto",
  },
};

// Builds the session config for one destination country. The address is
// always collected — automatic tax needs it even when shipping is paid later.
// `chargeShipping: false` drops the fee (held orders, and the shipping-only
// checkout that bills the fee as a line item). `allowPromotions: false` keeps
// promo codes off the shipping-only checkout.
export const buildStripeSessionConfig = (
  countryCode,
  { chargeShipping = true, allowPromotions = true } = {},
) => {
  const country = resolveShippingCountry(countryCode);

  const config = {
    ...BASE_SESSION_CONFIG,
    allow_promotion_codes: allowPromotions,
    shipping_address_collection: {
      allowed_countries: [country.code],
    },
  };
  if (!chargeShipping) return config;

  return {
    ...config,
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: country.amount, currency: "usd" },
          display_name: country.displayName,
          delivery_estimate: {
            minimum: {
              unit: "business_day",
              value: country.deliveryEstimate.minimum,
            },
            maximum: {
              unit: "business_day",
              value: country.deliveryEstimate.maximum,
            },
          },
        },
      },
    ],
  };
};

export const EXTRA_BAG_RATIO = 100; // 1 extra bag allowed per 100 minifigs

// The 0.5% rate and its calculation live in shared/ so the storefront shows
// exactly what checkout charges.
export {
  SHIPPING_INSURANCE_RATE,
  computeShippingInsurance,
} from "../../../shared/shippingData.js";

export const SHIPPING_INSURANCE_LABEL = "Shipping Insurance (0.5%)";

// Stripe Tax code for shipping charges, so a shipping-only checkout is taxed
// the way each state taxes shipping.
export const STRIPE_SHIPPING_TAX_CODE = "txcd_92010001";
