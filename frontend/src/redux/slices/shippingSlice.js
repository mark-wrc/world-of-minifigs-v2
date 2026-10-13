import { createSlice } from "@reduxjs/toolkit";
import {
  DEFAULT_SHIPPING_COUNTRY,
  isSupportedShippingCountry,
} from "@shared/shippingData";

const STORAGE_KEY = "shippingCountry";
const MODE_STORAGE_KEY = "shippingMode";

// Pay Now, Ship Later: ship this order now, or hold it and pay one flat
// shipping fee later for everything held. Mirrors SHIPPING_MODES on the backend.
export const SHIPPING_MODES = {
  SHIP_NOW: "ship_now",
  HOLD: "hold",
};

const isShippingMode = (value) =>
  Object.values(SHIPPING_MODES).includes(value);

const readStoredCountry = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isSupportedShippingCountry(stored) ? stored : DEFAULT_SHIPPING_COUNTRY;
};

const readStoredMode = () => {
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  return isShippingMode(stored) ? stored : SHIPPING_MODES.SHIP_NOW;
};

const initialState = {
  country: readStoredCountry(),
  mode: readStoredMode(),
  // Optional 0.5% shipping insurance on retail checkouts and on "Ship all
  // now". Dealer / wholesale pages keep their own (drafted) choice.
  insurance: false,
};

const shippingSlice = createSlice({
  name: "shipping",
  initialState,
  reducers: {
    setShippingCountry: (state, action) => {
      if (!isSupportedShippingCountry(action.payload)) return;
      state.country = action.payload;
      localStorage.setItem(STORAGE_KEY, action.payload);
    },
    setShippingMode: (state, action) => {
      if (!isShippingMode(action.payload)) return;
      state.mode = action.payload;
      localStorage.setItem(MODE_STORAGE_KEY, action.payload);
    },
    setShippingInsurance: (state, action) => {
      state.insurance = Boolean(action.payload);
    },
  },
});

export const {
  setShippingCountry,
  setShippingMode,
  setShippingInsurance,
} = shippingSlice.actions;

export default shippingSlice.reducer;
