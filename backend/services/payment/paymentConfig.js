// ------------------------- Constants --------------------------------

export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

export const SHIPPING_RATE_AMOUNT = 1280; // $12.80 in cents

export const STRIPE_SESSION_CONFIG = {
  mode: "payment",
  automatic_tax: { enabled: true },
  invoice_creation: { enabled: true },
  phone_number_collection: { enabled: true },
  allow_promotion_codes: true,
  customer_update: {
    shipping: "auto",
  },
  shipping_address_collection: {
    allowed_countries: ["US"],
  },
  shipping_options: [
    {
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: { amount: SHIPPING_RATE_AMOUNT, currency: "usd" },
        display_name: "Standard Shipping",
        delivery_estimate: {
          minimum: { unit: "business_day", value: 7 },
          maximum: { unit: "business_day", value: 14 },
        },
      },
    },
  ],
};

export const EXTRA_BAG_RATIO = 100; // 1 extra bag allowed per 100 minifigs

export const SHIPPING_INSURANCE_RATE = 0.005;
