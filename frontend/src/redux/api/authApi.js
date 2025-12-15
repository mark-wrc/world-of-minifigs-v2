import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/v1/auth",
    credentials: "include",
  }),
  tagTypes: ["User"],
  endpoints: (builder) => ({
    // ==================== Authentication ====================
    login: builder.mutation({
      query: (credentials) => ({
        url: "/login",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["User"],
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
      invalidatesTags: ["User"],
    }),

    // ==================== Verification ====================
    verifyEmail: builder.mutation({
      query: (token) => {
        // Ensure token is properly encoded for URL
        const encodedToken = encodeURIComponent(token);
        return {
          url: `/verify-email?token=${encodedToken}`,
          method: "GET",
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

    // ==================== Token Management ====================
    refreshToken: builder.mutation({
      query: () => ({
        url: "/refresh-token",
        method: "POST",
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useRefreshTokenMutation,
} = authApi;
