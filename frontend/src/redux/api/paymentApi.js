import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { clearCredentials } from "@/redux/slices/authSlice";
import { API_BASE_URL } from "@/redux/apiConfig";

// Base query with auth credentials
const baseQuery = fetchBaseQuery({
  baseUrl: `${API_BASE_URL}/api/v1/payment`,
  credentials: "include",
});

// Wrapper that handles 401 responses globally
const baseQueryWithAuth = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);
  if (result?.error?.status === 401) {
    api.dispatch(clearCredentials());
  }
  return result;
};

export const paymentApi = createApi({
  reducerPath: "paymentApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["Order"],
  endpoints: (builder) => ({
    // ==================== Checkout & Orders ====================
    getPaymentConfig: builder.query({
      query: () => ({
        url: "/config",
        method: "GET",
      }),
    }),
    createCheckoutSession: builder.mutation({
      query: (data) => ({
        url: "/create-checkout-session",
        method: "POST",
        body: data,
      }),
    }),
    // Stripe confirms by its session id; Square by our checkout reference.
    confirmOrder: builder.query({
      query: ({ gateway, ref }) => ({
        url: "/confirm-order",
        method: "GET",
        params: gateway === "square" ? { gateway, ref } : { session_id: ref },
      }),
    }),
  }),
});

export const {
  useGetPaymentConfigQuery,
  useCreateCheckoutSessionMutation,
  useConfirmOrderQuery,
} = paymentApi;
