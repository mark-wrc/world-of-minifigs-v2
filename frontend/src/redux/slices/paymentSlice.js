import { createSlice } from "@reduxjs/toolkit";

export const PAYMENT_GATEWAYS = ["stripe", "square"];

const STORAGE_KEY = "paymentGateway";

const readStoredGateway = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return PAYMENT_GATEWAYS.includes(stored) ? stored : null;
};

const initialState = {
  // The buyer's pick; null until they choose, so the server default applies.
  gateway: readStoredGateway(),
};

const paymentSlice = createSlice({
  name: "payment",
  initialState,
  reducers: {
    setPaymentGateway: (state, action) => {
      if (!PAYMENT_GATEWAYS.includes(action.payload)) return;
      state.gateway = action.payload;
      localStorage.setItem(STORAGE_KEY, action.payload);
    },
  },
});

export const { setPaymentGateway } = paymentSlice.actions;

export default paymentSlice.reducer;
