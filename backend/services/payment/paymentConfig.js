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

// Builds the session config for one destination country.
export const buildStripeSessionConfig = (countryCode) => {
  const country = resolveShippingCountry(countryCode);

  return {
    ...BASE_SESSION_CONFIG,
    shipping_address_collection: {
      allowed_countries: [country.code],
    },
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

export const SHIPPING_INSURANCE_RATE = 0.005;
