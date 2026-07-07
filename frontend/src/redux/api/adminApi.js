import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { clearCredentials } from "@/redux/slices/authSlice";
import { API_BASE_URL } from "@/redux/apiConfig";
import { authApi } from "@/redux/api/authApi";

// Base query with auth credentials
const baseQuery = fetchBaseQuery({
  baseUrl: `${API_BASE_URL}/api/v1/admin`,
  credentials: "include",
});

// Wrapper that handles 401 responses globally
const baseQueryWithAuth = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);

  // If we get a 401, clear credentials (session expired)
  if (result?.error?.status === 401) {
    api.dispatch(clearCredentials());
  }

  return result;
};

// Helper function to build pagination and search params
const buildPaginationParams = ({
  page,
  limit,
  search,
  category,
  status,
  stock,
  partType,
  collectionId,
  sort,
} = {}) => {
  return {
    ...(page && { page }),
    ...(limit && { limit }),
    ...(search &&
      typeof search === "string" &&
      search.trim() && { search: search.trim() }),
    ...(category && { category }),
    ...(status && { status }),
    ...(stock && { stock }),
    ...(partType && { partType }),
    ...(collectionId && { collectionId }),
    ...(sort && { sort }),
  };
};

export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    "Color",
    "Category",
    "SubCategory",
    "SkillLevel",
    "Collection",
    "SubCollection",
    "User",
    "Product",
    "Banner",
    "DealerBundle",
    "DealerAddon",
    "DealerExtraBag",
    "DealerTorsoBag",
    "RewardBundle",
    "RewardAddon",
    "Order",
    "GeneralInventory",
  ],
  endpoints: (builder) => ({
    // ==================== Banner Management ====================

    // Get all banners
    getBanners: builder.query({
      query: (params = {}) => ({
        url: "/banners",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["Banner"],
    }),

    // Create banner (admin only)
    createBanner: builder.mutation({
      query: (bannerData) => ({
        url: "/banners",
        method: "POST",
        body: bannerData,
      }),
      invalidatesTags: ["Banner"],
    }),

    // Update banner (admin only)
    updateBanner: builder.mutation({
      query: ({ id, ...bannerData }) => ({
        url: `/banners/${id}`,
        method: "PUT",
        body: bannerData,
      }),
      invalidatesTags: (_, __, { id }) => [{ type: "Banner", id }, "Banner"],
    }),

    // Delete banner (admin only)
    deleteBanner: builder.mutation({
      query: (id) => ({
        url: `/banners/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Banner"],
    }),

    // ==================== Product Management ====================
    // Get all products
    getProducts: builder.query({
      query: (params = {}) => ({
        url: "/products",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["Product"],
    }),

    // Create product (admin only)
    createProduct: builder.mutation({
      query: (productData) => ({
        url: "/products",
        method: "POST",
        body: productData,
      }),
      invalidatesTags: ["Product"],
    }),

    // Update product (admin only)
    updateProduct: builder.mutation({
      query: ({ id, ...productData }) => ({
        url: `/products/${id}`,
        method: "PUT",
        body: productData,
      }),
      invalidatesTags: (_, __, { id }) => [{ type: "Product", id }, "Product"],
    }),

    // Delete product (admin only)
    deleteProduct: builder.mutation({
      query: (id) => ({
        url: `/products/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Product"],
    }),

    // ==================== Color Management ====================
    // Get all colors
    getColors: builder.query({
      query: (params = {}) => ({
        url: "/colors",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["Color"],
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
      query: (params = {}) => ({
        url: "/categories",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["Category"],
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
      query: (params = {}) => ({
        url: "/subCategories",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["SubCategory"],
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

    // ==================== Collection Management ====================
    // Get all collections
    getCollections: builder.query({
      query: (params = {}) => ({
        url: "/collections",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["Collection"],
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
      query: (params = {}) => ({
        url: "/subCollections",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["SubCollection"],
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

    // ==================== Dealer Management ====================

    // --- Bundles ---
    getDealerBundles: builder.query({
      query: (params = {}) => ({
        url: "/dealer/bundles",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["DealerBundle"],
    }),
    createDealerBundle: builder.mutation({
      query: (data) => ({
        url: "/dealer/bundles",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["DealerBundle"],
    }),
    updateDealerBundle: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/dealer/bundles/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["DealerBundle"],
    }),
    deleteDealerBundle: builder.mutation({
      query: (id) => ({
        url: `/dealer/bundles/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["DealerBundle"],
    }),

    // --- Addons ---
    getDealerAddons: builder.query({
      query: (params = {}) => ({
        url: "/dealer/addons",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["DealerAddon"],
    }),
    createDealerAddon: builder.mutation({
      query: (data) => ({
        url: "/dealer/addons",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["DealerAddon"],
    }),
    updateDealerAddon: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/dealer/addons/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["DealerAddon"],
    }),
    deleteDealerAddon: builder.mutation({
      query: (id) => ({
        url: `/dealer/addons/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["DealerAddon"],
    }),
    reorderDealerAddonItems: builder.mutation({
      query: ({ id, itemOrder }) => ({
        url: `/dealer/addons/${id}/reorder`,
        method: "PATCH",
        body: { itemOrder },
      }),
      invalidatesTags: ["DealerAddon"],
      // Also refresh the dealer-facing addon list (a separate api slice) so the
      // new order shows immediately when an admin reorders from the store page.
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(authApi.util.invalidateTags(["Addon"]));
        } catch {
          // Reorder failed — leave the cache untouched.
        }
      },
    }),

    // --- Extra Bags ---
    getDealerExtraBags: builder.query({
      query: (params = {}) => ({
        url: "/dealer/extra-bags",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["DealerExtraBag"],
    }),
    createDealerExtraBag: builder.mutation({
      query: (data) => ({
        url: "/dealer/extra-bags",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["DealerExtraBag"],
    }),
    updateDealerExtraBag: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/dealer/extra-bags/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["DealerExtraBag"],
    }),
    deleteDealerExtraBag: builder.mutation({
      query: (id) => ({
        url: `/dealer/extra-bags/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["DealerExtraBag"],
    }),

    // --- Torso Bags ---
    getDealerTorsoBags: builder.query({
      query: (params = {}) => ({
        url: "/dealer/torso-bags",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["DealerTorsoBag"],
    }),
    createDealerTorsoBag: builder.mutation({
      query: (data) => ({
        url: "/dealer/torso-bags",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["DealerTorsoBag"],
    }),
    updateDealerTorsoBag: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/dealer/torso-bags/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["DealerTorsoBag"],
    }),
    deleteDealerTorsoBag: builder.mutation({
      query: (id) => ({
        url: `/dealer/torso-bags/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["DealerTorsoBag"],
    }),
    reorderTorsoBagItems: builder.mutation({
      query: ({ id, itemOrder }) => ({
        url: `/dealer/torso-bags/${id}/reorder`,
        method: "PATCH",
        body: { itemOrder },
      }),
      invalidatesTags: ["DealerTorsoBag"],
    }),

    // ==================== Reward Program Management ====================

    // --- Reward Bundles ---
    getRewardBundles: builder.query({
      query: (params = {}) => ({
        url: "/reward/bundles",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["RewardBundle"],
    }),
    createRewardBundle: builder.mutation({
      query: (data) => ({
        url: "/reward/bundles",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["RewardBundle"],
    }),
    updateRewardBundle: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/reward/bundles/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["RewardBundle"],
    }),
    deleteRewardBundle: builder.mutation({
      query: (id) => ({
        url: `/reward/bundles/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["RewardBundle"],
    }),

    // --- Reward Addons ---
    getRewardAddons: builder.query({
      query: (params = {}) => ({
        url: "/reward/addons",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["RewardAddon"],
    }),
    createRewardAddon: builder.mutation({
      query: (data) => ({
        url: "/reward/addons",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["RewardAddon"],
    }),
    updateRewardAddon: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/reward/addons/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["RewardAddon"],
    }),
    deleteRewardAddon: builder.mutation({
      query: (id) => ({
        url: `/reward/addons/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["RewardAddon"],
    }),

    // ==================== SkillLevel Management ====================
    // Get all skillLevels
    getSkillLevels: builder.query({
      query: (params = {}) => ({
        url: "/skillLevels",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["SkillLevel"],
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

    // ==================== Order Management ====================
    // Get all orders
    getOrders: builder.query({
      query: (params = {}) => ({
        url: "/orders",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["Order"],
    }),

    // Update order status (admin only)
    updateOrderStatus: builder.mutation({
      query: ({
        id,
        status,
        carrier,
        trackingNumber,
        trackingLink,
        reason,
        notes,
      }) => ({
        url: `/orders/${id}/status`,
        method: "PATCH",
        body: {
          status,
          ...(carrier && { carrier }),
          ...(trackingNumber && { trackingNumber }),
          ...(trackingLink && { trackingLink }),
          ...(reason && { reason }),
          ...(notes && { notes }),
        },
      }),
      invalidatesTags: ["Order"],
    }),

    // ==================== User Management ====================
    // Get all users
    getUsers: builder.query({
      query: (params = {}) => ({
        url: "/users",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["User"],
    }),

    // Update user role
    updateUserRole: builder.mutation({
      query: ({ id, role }) => ({
        url: `/users/${id}/role`,
        method: "PUT",
        body: { role },
      }),
      invalidatesTags: ["User"],
    }),

    // Update user tax exempt status
    updateUserTaxExempt: builder.mutation({
      query: ({ id, isTaxExempt }) => ({
        url: `/users/${id}/tax-exempt`,
        method: "PUT",
        body: { isTaxExempt },
      }),
      invalidatesTags: ["User"],
    }),

    // ==================== General Inventory Management ====================
    getGeneralInventory: builder.query({
      query: (params = {}) => ({
        url: "/general-inventory",
        method: "GET",
        params: buildPaginationParams(params),
      }),
      providesTags: ["GeneralInventory"],
    }),

    createGeneralInventoryBulk: builder.mutation({
      query: (data) => ({
        url: "/general-inventory/bulk",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["GeneralInventory"],
    }),

    updateGeneralInventory: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/general-inventory/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["GeneralInventory"],
    }),

    deleteGeneralInventory: builder.mutation({
      query: (id) => ({
        url: `/general-inventory/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["GeneralInventory"],
    }),
  }),
});

export const {
  useGetBannersQuery,
  useCreateBannerMutation,
  useUpdateBannerMutation,
  useDeleteBannerMutation,

  useGetProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,

  useGetColorsQuery,
  useCreateColorMutation,
  useUpdateColorMutation,
  useDeleteColorMutation,

  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,

  useGetSubCategoriesQuery,
  useCreateSubCategoryMutation,
  useUpdateSubCategoryMutation,
  useDeleteSubCategoryMutation,

  useGetCollectionsQuery,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,

  useGetSubCollectionsQuery,
  useCreateSubCollectionMutation,
  useUpdateSubCollectionMutation,
  useDeleteSubCollectionMutation,

  useGetDealerBundlesQuery,
  useCreateDealerBundleMutation,
  useUpdateDealerBundleMutation,
  useDeleteDealerBundleMutation,
  useGetDealerAddonsQuery,
  useCreateDealerAddonMutation,
  useUpdateDealerAddonMutation,
  useDeleteDealerAddonMutation,
  useReorderDealerAddonItemsMutation,
  useGetDealerExtraBagsQuery,
  useCreateDealerExtraBagMutation,
  useUpdateDealerExtraBagMutation,
  useDeleteDealerExtraBagMutation,
  useGetDealerTorsoBagsQuery,
  useCreateDealerTorsoBagMutation,
  useUpdateDealerTorsoBagMutation,
  useDeleteDealerTorsoBagMutation,
  useReorderTorsoBagItemsMutation,

  useGetRewardBundlesQuery,
  useCreateRewardBundleMutation,
  useUpdateRewardBundleMutation,
  useDeleteRewardBundleMutation,
  useGetRewardAddonsQuery,
  useCreateRewardAddonMutation,
  useUpdateRewardAddonMutation,
  useDeleteRewardAddonMutation,

  useGetSkillLevelsQuery,
  useCreateSkillLevelMutation,
  useUpdateSkillLevelMutation,
  useDeleteSkillLevelMutation,

  useGetOrdersQuery,
  useUpdateOrderStatusMutation,

  useGetUsersQuery,
  useUpdateUserRoleMutation,
  useUpdateUserTaxExemptMutation,

  useGetGeneralInventoryQuery,
  useCreateGeneralInventoryBulkMutation,
  useUpdateGeneralInventoryMutation,
  useDeleteGeneralInventoryMutation,
} = adminApi;
