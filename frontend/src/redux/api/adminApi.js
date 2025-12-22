import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/v1/admin",
    credentials: "include",
  }),
  tagTypes: ["Color", "Category", "SubCategory"],
  endpoints: (builder) => ({
    // ==================== Color Management ====================
    // Get all colors
    getColors: builder.query({
      query: () => ({
        url: "/colors",
        method: "GET",
      }),
      providesTags: ["Color"],
    }),

    // Get single color by ID
    getColorById: builder.query({
      query: (id) => ({
        url: `/colors/${id}`,
        method: "GET",
      }),
      providesTags: (_, __, id) => [{ type: "Color", id }],
    }),

    // Create color (admin only)
    createColor: builder.mutation({
      query: (colorData) => ({
        url: "/colors",
        method: "POST",
        body: colorData,
      }),
      invalidatesTags: ["Color"],
    }),

    // Update color (admin only)
    updateColor: builder.mutation({
      query: ({ id, ...colorData }) => ({
        url: `/colors/${id}`,
        method: "PUT",
        body: colorData,
      }),
      invalidatesTags: (_, __, { id }) => [{ type: "Color", id }, "Color"],
    }),

    // Delete color (admin only)
    deleteColor: builder.mutation({
      query: (id) => ({
        url: `/colors/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Color"],
    }),

    // ==================== Category Management ====================
    // Get all categories
    getCategories: builder.query({
      query: () => ({
        url: "/categories",
        method: "GET",
      }),
      providesTags: ["Category"],
    }),

    // Get single category by ID
    getCategoryById: builder.query({
      query: (id) => ({
        url: `/categories/${id}`,
        method: "GET",
      }),
      providesTags: (_, __, id) => [{ type: "Category", id }],
    }),

    // Create category (admin only)
    createCategory: builder.mutation({
      query: (categoryData) => ({
        url: "/categories",
        method: "POST",
        body: categoryData,
      }),
      invalidatesTags: ["Category"],
    }),

    // Update category (admin only)
    updateCategory: builder.mutation({
      query: ({ id, ...categoryData }) => ({
        url: `/categories/${id}`,
        method: "PUT",
        body: categoryData,
      }),
      invalidatesTags: (_, __, { id }) => [
        { type: "Category", id },
        "Category",
      ],
    }),

    // Delete category (admin only)
    deleteCategory: builder.mutation({
      query: (id) => ({
        url: `/categories/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Category"],
    }),

    // ==================== SubCategory Management ====================
    // Get all subCategories
    getSubCategories: builder.query({
      query: () => ({
        url: "/subCategories",
        method: "GET",
      }),
      providesTags: ["SubCategory"],
    }),

    // Get single subCategory by ID
    getSubCategoryById: builder.query({
      query: (id) => ({
        url: `/subCategories/${id}`,
        method: "GET",
      }),
      providesTags: (_, __, id) => [{ type: "SubCategory", id }],
    }),

    // Create subCategory (admin only)
    createSubCategory: builder.mutation({
      query: (subCategoryData) => ({
        url: "/subCategories",
        method: "POST",
        body: subCategoryData,
      }),
      invalidatesTags: ["SubCategory"],
    }),

    // Update subCategory (admin only)
    updateSubCategory: builder.mutation({
      query: ({ id, ...subCategoryData }) => ({
        url: `/subCategories/${id}`,
        method: "PUT",
        body: subCategoryData,
      }),
      invalidatesTags: (_, __, { id }) => [
        { type: "SubCategory", id },
        "SubCategory",
      ],
    }),

    // Delete subCategory (admin only)
    deleteSubCategory: builder.mutation({
      query: (id) => ({
        url: `/subCategories/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["SubCategory"],
    }),
  }),
});

export const {
  useGetColorsQuery,
  useGetColorByIdQuery,
  useCreateColorMutation,
  useUpdateColorMutation,
  useDeleteColorMutation,
  useGetCategoriesQuery,
  useGetCategoryByIdQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useGetSubCategoriesQuery,
  useGetSubCategoryByIdQuery,
  useCreateSubCategoryMutation,
  useUpdateSubCategoryMutation,
  useDeleteSubCategoryMutation,
} = adminApi;
