import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/v1/admin",
    credentials: "include",
  }),
  tagTypes: ["Color", "Category", "SubCategory", "SkillLevel", "Collection", "SubCollection", "User"],
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

    // ==================== SkillLevel Management ====================
    // Get all skillLevels
    getSkillLevels: builder.query({
      query: () => ({
        url: "/skillLevels",
        method: "GET",
      }),
      providesTags: ["SkillLevel"],
    }),

    // Get single skillLevel by ID
    getSkillLevelById: builder.query({
      query: (id) => ({
        url: `/skillLevels/${id}`,
        method: "GET",
      }),
      providesTags: (_, __, id) => [{ type: "SkillLevel", id }],
    }),

    // Create skillLevel (admin only)
    createSkillLevel: builder.mutation({
      query: (skillLevelData) => ({
        url: "/skillLevels",
        method: "POST",
        body: skillLevelData,
      }),
      invalidatesTags: ["SkillLevel"],
    }),

    // Update skillLevel (admin only)
    updateSkillLevel: builder.mutation({
      query: ({ id, ...skillLevelData }) => ({
        url: `/skillLevels/${id}`,
        method: "PUT",
        body: skillLevelData,
      }),
      invalidatesTags: (_, __, { id }) => [
        { type: "SkillLevel", id },
        "SkillLevel",
      ],
    }),

    // Delete skillLevel (admin only)
    deleteSkillLevel: builder.mutation({
      query: (id) => ({
        url: `/skillLevels/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["SkillLevel"],
    }),

    // ==================== Collection Management ====================
    // Get all collections
    getCollections: builder.query({
      query: () => ({
        url: "/collections",
        method: "GET",
      }),
      providesTags: ["Collection"],
    }),

    // Get single collection by ID
    getCollectionById: builder.query({
      query: (id) => ({
        url: `/collections/${id}`,
        method: "GET",
      }),
      providesTags: (_, __, id) => [{ type: "Collection", id }],
    }),

    // Create collection (admin only)
    createCollection: builder.mutation({
      query: (collectionData) => ({
        url: "/collections",
        method: "POST",
        body: collectionData,
      }),
      invalidatesTags: ["Collection"],
    }),

    // Update collection (admin only)
    updateCollection: builder.mutation({
      query: ({ id, ...collectionData }) => ({
        url: `/collections/${id}`,
        method: "PUT",
        body: collectionData,
      }),
      invalidatesTags: (_, __, { id }) => [
        { type: "Collection", id },
        "Collection",
      ],
    }),

    // Delete collection (admin only)
    deleteCollection: builder.mutation({
      query: (id) => ({
        url: `/collections/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Collection"],
    }),

    // ==================== SubCollection Management ====================
    // Get all subCollections
    getSubCollections: builder.query({
      query: () => ({
        url: "/subCollections",
        method: "GET",
      }),
      providesTags: ["SubCollection"],
    }),

    // Get single subCollection by ID
    getSubCollectionById: builder.query({
      query: (id) => ({
        url: `/subCollections/${id}`,
        method: "GET",
      }),
      providesTags: (_, __, id) => [{ type: "SubCollection", id }],
    }),

    // Create subCollection (admin only)
    createSubCollection: builder.mutation({
      query: (subCollectionData) => ({
        url: "/subCollections",
        method: "POST",
        body: subCollectionData,
      }),
      invalidatesTags: ["SubCollection"],
    }),

    // Update subCollection (admin only)
    updateSubCollection: builder.mutation({
      query: ({ id, ...subCollectionData }) => ({
        url: `/subCollections/${id}`,
        method: "PUT",
        body: subCollectionData,
      }),
      invalidatesTags: (_, __, { id }) => [
        { type: "SubCollection", id },
        "SubCollection",
      ],
    }),

    // Delete subCollection (admin only)
    deleteSubCollection: builder.mutation({
      query: (id) => ({
        url: `/subCollections/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["SubCollection"],
    }),

    // ==================== User Management ====================
    // Get all users
    getUsers: builder.query({
      query: () => ({
        url: "/users",
        method: "GET",
      }),
      providesTags: ["User"],
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
  useGetSkillLevelsQuery,
  useGetSkillLevelByIdQuery,
  useCreateSkillLevelMutation,
  useUpdateSkillLevelMutation,
  useDeleteSkillLevelMutation,
  useGetCollectionsQuery,
  useGetCollectionByIdQuery,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
  useGetSubCollectionsQuery,
  useGetSubCollectionByIdQuery,
  useCreateSubCollectionMutation,
  useUpdateSubCollectionMutation,
  useDeleteSubCollectionMutation,
  useGetUsersQuery,
} = adminApi;
