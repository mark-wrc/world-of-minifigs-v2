import { createSlice } from "@reduxjs/toolkit";
import {
  DEFAULT_SHIPPING_COUNTRY,
  isSupportedShippingCountry,
} from "@shared/shippingData";

const STORAGE_KEY = "shippingCountry";

const readStoredCountry = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isSupportedShippingCountry(stored) ? stored : DEFAULT_SHIPPING_COUNTRY;
};

const initialState = {
  country: readStoredCountry(),
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
  },
});

export const { setShippingCountry } = shippingSlice.actions;

export default shippingSlice.reducer;
