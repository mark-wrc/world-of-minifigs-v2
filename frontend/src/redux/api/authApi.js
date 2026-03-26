import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { clearCredentials } from "@/redux/slices/authSlice";
import { API_BASE_URL } from "@/redux/apiConfig";

// Base query with auth credentials
const baseQuery = fetchBaseQuery({
  baseUrl: `${API_BASE_URL}/api/v1/auth`,
  credentials: "include",
});

// Wrapper that handles 401 responses globally
const baseQueryWithAuth = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);

  // If we get a 401, clear credentials (session expired)
  // But only if it's not the /me endpoint (which might fail due to cookie timing)
  // The /me endpoint failure will be handled by useAuthInit
  if (result?.error?.status === 401) {
    const url = typeof args === "string" ? args : args?.url || "";
    // Don't clear credentials on /me 401 immediately after login
    // Let useAuthInit handle it with proper timing
    if (!url.includes("/me")) {
      api.dispatch(clearCredentials());
    }
  }

  return result;
};

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    "User",
    "Cart",
    "Bundle",
    "Addon",
    "ExtraBag",
    "TorsoBag",
    "UserOrder",
  ],
  endpoints: (builder) => ({
    // ==================== Authentication ====================
    login: builder.mutation({
      query: (credentials) => ({
        url: "/login",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["User", "Cart"],
    }),

    register: builder.mutation({
      query: (userData) => ({
        url: "/register",
        method: "POST",
        body: userData,
      }),
    }),

    logout: builder.mutation({
      query: () => ({
        url: "/logout",
        method: "POST",
      }),
      invalidatesTags: ["User", "Cart"],
    }),

    // ==================== Verification ====================
    verifyEmail: builder.mutation({
      query: (token) => {
        const encodedToken = encodeURIComponent(token);
        return {
          url: "/verify-email",
          method: "POST",
          body: { token: encodedToken },
        };
      },
    }),

    resendVerification: builder.mutation({
      query: (data) => ({
        url: "/resend-verification",
        method: "POST",
        body: data,
      }),
    }),

    // ==================== User Management ====================
    getCurrentUser: builder.query({
      query: () => ({
        url: "/me",
        method: "GET",
      }),
      providesTags: ["User"],
    }),

    // ==================== Change Password (Authenticated) ====================
    changePassword: builder.mutation({
      query: (data) => ({
        url: "/change-password",
        method: "PUT",
        body: data,
      }),
    }),

    // ==================== Forgot/Reset Password ====================
    forgotPassword: builder.mutation({
      query: (data) => ({
        url: "/forgot-password",
        method: "POST",
        body: data,
      }),
    }),

    resetPassword: builder.mutation({
      query: (data) => ({
        url: "/reset-password",
        method: "POST",
        body: data,
      }),
    }),

    // ==================== Cart Management ====================
    getCart: builder.query({
      query: () => ({ url: "/cart", method: "GET" }),
      providesTags: ["Cart"],
    }),

    addToCart: builder.mutation({
      query: (data) => ({
        url: "/cart",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Cart"],
    }),

    updateCartItem: builder.mutation({
      query: (data) => ({
        url: "/cart/item",
        method: "PUT",
        body: data,
      }),
      async onQueryStarted(
        { productId, variantIndex, quantity },
        { dispatch, queryFulfilled },
      ) {
        const patchResult = dispatch(
          authApi.util.updateQueryData("getCart", undefined, (draft) => {
            const item = draft.cart.items.find(
              (i) =>
                i.productId === productId && i.variantIndex === variantIndex,
            );
            if (item) {
              item.quantity = quantity;
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
      invalidatesTags: ["Cart"],
    }),

    removeCartItem: builder.mutation({
      query: ({ productId, variantIndex }) => ({
        url: "/cart/item",
        method: "DELETE",
        params: { productId, variantIndex },
      }),
      async onQueryStarted(
        { productId, variantIndex },
        { dispatch, queryFulfilled },
      ) {
        const patchResult = dispatch(
          authApi.util.updateQueryData("getCart", undefined, (draft) => {
            draft.cart.items = draft.cart.items.filter(
              (i) =>
                !(i.productId === productId && i.variantIndex === variantIndex),
            );
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
      invalidatesTags: ["Cart"],
    }),

    clearCart: builder.mutation({
      query: () => ({
        url: "/cart",
        method: "DELETE",
      }),
      invalidatesTags: ["Cart"],
    }),

    syncCart: builder.mutation({
      query: (items) => ({
        url: "/cart/sync",
        method: "POST",
        body: { items },
      }),
      invalidatesTags: ["Cart"],
    }),

    // ==================== Order Management (User) ====================
    getOrderConfig: builder.query({
      query: () => ({ url: "/orders/config", method: "GET" }),
      keepUnusedDataFor: 3600,
    }),

    getUserOrders: builder.query({
      query: (params = {}) => ({
        url: "/orders",
        method: "GET",
        params: {
          ...(params.page && { page: params.page }),
          ...(params.limit && { limit: params.limit }),
          ...(params.search?.trim() && { search: params.search.trim() }),
          ...(params.status && { status: params.status }),
        },
      }),
      providesTags: ["UserOrder"],
    }),

    getUserOrderById: builder.query({
      query: (id) => ({
        url: `/orders/${id}`,
        method: "GET",
      }),
      providesTags: (_, __, id) => [{ type: "UserOrder", id }],
    }),

    cancelOrder: builder.mutation({
      query: ({ id, reason, notes }) => ({
        url: `/orders/${id}/cancel`,
        method: "POST",
        body: { reason, notes },
      }),
      invalidatesTags: ["UserOrder"],
    }),

    // ==================== Others ====================
    sendContactMessage: builder.mutation({
      query: (data) => ({
        url: "/contact",
        method: "POST",
        body: data,
      }),
    }),

    // ==================== Dealer Management ====================
    getDealerBundles: builder.query({
      query: () => ({ url: "/dealer/bundles", method: "GET" }),
      providesTags: ["Bundle"],
    }),
    getDealerAddons: builder.query({
      query: () => ({ url: "/dealer/addons", method: "GET" }),
      providesTags: ["Addon"],
    }),
    getDealerExtraBags: builder.query({
      query: () => ({ url: "/dealer/extra-bags", method: "GET" }),
      providesTags: ["ExtraBag"],
    }),
    getDealerTorsoBags: builder.query({
      query: (params = {}) => ({
        url: "/dealer/torso-bags",
        params,
      }),
      providesTags: ["TorsoBag"],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useChangePasswordMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,

  useGetCurrentUserQuery,

  useGetCartQuery,
  useAddToCartMutation,
  useUpdateCartItemMutation,
  useRemoveCartItemMutation,
  useClearCartMutation,
  useSyncCartMutation,

  useGetOrderConfigQuery,
  useGetUserOrdersQuery,
  useGetUserOrderByIdQuery,
  useCancelOrderMutation,

  useSendContactMessageMutation,

  useGetDealerBundlesQuery,
  useGetDealerAddonsQuery,
  useGetDealerExtraBagsQuery,
  useGetDealerTorsoBagsQuery,
} = authApi;
