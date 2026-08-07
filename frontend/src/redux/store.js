import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { authApi } from "@/redux/api/authApi";
import { adminApi } from "@/redux/api/adminApi";
import { publicApi } from "@/redux/api/publicApi";
import { paymentApi } from "@/redux/api/paymentApi";
import authReducer from "@/redux/slices/authSlice";
import cartReducer from "@/redux/slices/cartSlice";
import shippingReducer from "@/redux/slices/shippingSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    shipping: shippingReducer,
    [authApi.reducerPath]: authApi.reducer,
    [adminApi.reducerPath]: adminApi.reducer,
    [publicApi.reducerPath]: publicApi.reducer,
    [paymentApi.reducerPath]: paymentApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      adminApi.middleware,
      publicApi.middleware,
      paymentApi.middleware,
    ),
});

setupListeners(store.dispatch);

export default store;
