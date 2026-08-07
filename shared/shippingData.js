export const SHIPPING_COUNTRIES = [
  {
    code: "US",
    label: "United States",
    amount: 1280, // $12.80
    displayName: "Standard Shipping",
    // Business days shown to the buyer on the Stripe Checkout page.
    deliveryEstimate: { minimum: 7, maximum: 14 },
  },
  {
    code: "CA",
    label: "Canada",
    amount: 2840, // $28.40
    displayName: "Standard Shipping (Canada)",
    // Same window as US until a real cross-border estimate is confirmed.
    deliveryEstimate: { minimum: 7, maximum: 14 },
  },
];

export const DEFAULT_SHIPPING_COUNTRY = "US";

export const SHIPPING_COUNTRY_CODES = SHIPPING_COUNTRIES.map((c) => c.code);

export const isSupportedShippingCountry = (code) =>
  SHIPPING_COUNTRY_CODES.includes(code);

export const getShippingCountry = (code) =>
  SHIPPING_COUNTRIES.find((c) => c.code === code);

// Never throws: an absent or stale country falls back to the default so a
// checkout can't be blocked by it. Callers that must reject a bad value
// (the API) validate with isSupportedShippingCountry first.
export const resolveShippingCountry = (code) =>
  getShippingCountry(code) || getShippingCountry(DEFAULT_SHIPPING_COUNTRY);
