import mongoose from "mongoose";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import SubCategory from "../models/subCategory.model.js";
import Collection from "../models/collection.model.js";
import SubCollection from "../models/subCollection.model.js";
import Color from "../models/color.model.js";
import SkillLevel from "../models/skillLevel.model.js";
import {
  normalizeImageRef,
  normalizeImageRefs,
  cleanupRemovedImages,
  cleanupItemImages,
  deleteMultipleImages,
} from "../services/imageService.js";
import {
  normalizePagination,
  paginateQuery,
  createPaginationResponse,
} from "../utils/pagination.js";
import {
  buildSortObject,
  buildPublicProductQuery,
  buildProductSearchQuery,
} from "../utils/Products/productQueryBuilder.js";
import {
  processProductsForListing,
  filterProductByType,
  processProductForDetails,
} from "../utils/Products/productProcessor.js";
import {
  getCategoryCounts,
  getCollectionCounts,
  getColorCounts,
  getSkillLevelCounts,
} from "../utils/Products/productCountUtils.js";
import {
  validateForeignKeys,
  checkProductExists,
} from "../utils/Products/productValidation.js";
import { calculateDiscountPrice } from "../utils/Products/productPriceUtils.js";
import {
  validatePriceParams,
  validateSortBy,
  validateAndFilterIds,
  validatePublicProductLimit,
  DEFAULT_PUBLIC_PRODUCT_LIMIT,
} from "../utils/Products/productQueryValidator.js";
import { onProductToggle } from "../utils/Products/visibilityUtils.js";

// Product & variant images upload browser→Cloudinary directly; folders
// (product, product-variant) are owned by uploadController.js.

//------------------------------------------------ Helpers ------------------------------------------

const PRODUCT_DETAILS_POPULATE = [
  { path: "categoryIds", select: "categoryName" },
  { path: "subCategoryIds", select: "subCategoryName" },
  { path: "collectionIds", select: "collectionName" },
  { path: "subCollectionIds", select: "subCollectionName" },
  { path: "colorId", select: "colorName hexCode" },
  { path: "secondaryColorId", select: "colorName hexCode" },
  { path: "skillLevelIds", select: "skillLevelName" },
  { path: "createdBy", select: "firstName lastName username" },
  { path: "variants.colorId", select: "colorName hexCode" },
  { path: "variants.secondaryColorId", select: "colorName hexCode" },
];

const PRODUCT_DETAILS_POPULATE_WITH_UPDATED = [
  ...PRODUCT_DETAILS_POPULATE,
  { path: "updatedBy", select: "firstName lastName username" },
];

// Shared select fields for public product listings
const PUBLIC_LISTING_SELECT =
  "_id productName price discount discountPrice productType createdAt images variants stock";

// Shared populate chain for public product listings
const PUBLIC_LISTING_POPULATE = [
  { path: "categoryIds", select: "categoryName" },
  { path: "subCategoryIds", select: "subCategoryName" },
  { path: "collectionIds", select: "collectionName" },
  { path: "subCollectionIds", select: "subCollectionName" },
  { path: "colorId", select: "colorName hexCode" },
  { path: "secondaryColorId", select: "colorName hexCode" },
  { path: "skillLevelIds", select: "skillLevelName" },
  { path: "variants.colorId", select: "colorName hexCode" },
  { path: "variants.secondaryColorId", select: "colorName hexCode" },
];

// Apply populate chain to a Mongoose query
const applyPublicPopulate = (query) => {
  for (const pop of PUBLIC_LISTING_POPULATE) {
    query = query.populate(pop.path, pop.select);
  }
  return query;
};

// Generic words to exclude from name-based product matching
const NAME_MATCH_GENERIC_WORDS = [
  "legs",
  "torso",
  "head",
  "hair",
  "helmet",
  "cape",
  "armor",
  "shield",
  "weapon",
  "the",
  "with",
  "and",
  "for",
];

//------------------------------------------------ Create Product ------------------------------------------
export const createProduct = async (req, res) => {
  try {
    const {
      productName,
      productType, // "standalone" or "variant"
      partId,
      itemId,
      price,
      discount,
      descriptions,
      images, // For standalone products - array of base64 strings
      categoryIds,
      subCategoryIds,
      collectionIds,
      subCollectionIds,
      pieceCount,
      length,
      width,
      height,
      colorId, // For standalone products
      secondaryColorId,
      skillLevelIds,
      stock, // For standalone products
      isActive,
      variants, // Array of variants for productType === "variant"
    } = req.body;

    // Validate required fields
    if (!productName || !productName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
        description: "Please provide a product name.",
      });
    }

    if (!price || price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid price is required",
        description: "Price must be a positive number.",
      });
    }

    if (
      !descriptions ||
      !Array.isArray(descriptions) ||
      descriptions.length === 0 ||
      !descriptions[0]?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Description is required",
        description: "Please provide at least one description.",
      });
    }

    if (descriptions.length > 3) {
      return res.status(400).json({
        success: false,
        message: "Too many descriptions",
        description: "Maximum of 3 descriptions are allowed.",
      });
    }

    // Determine product type - use provided productType or infer from variants
    const hasVariants =
      variants && Array.isArray(variants) && variants.length > 0;
    const inferredProductType = hasVariants ? "variant" : "standalone";
    const finalProductType = productType || inferredProductType;

    // Validate productType
    if (finalProductType !== "standalone" && finalProductType !== "variant") {
      return res.status(400).json({
        success: false,
        message: "Invalid product type",
        description: "Product type must be either 'standalone' or 'variant'.",
      });
    }

    const isStandalone = finalProductType === "standalone";

    // Validate standalone product fields
    if (isStandalone) {
      if (!itemId || !itemId.trim()) {
        return res.status(400).json({
          success: false,
          message: "Item ID is required",
          description: "Item ID is required for standalone products.",
        });
      }

      // Check uniqueness for standalone products
      const existingProduct = await checkProductExists(partId, itemId);

      if (existingProduct) {
        return res.status(409).json({
          success: false,
          message: "Product already exists",
          description:
            "A product with this Part ID and Item ID already exists.",
        });
      }

      // Validate images for standalone
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Images are required",
          description:
            "At least one image is required for standalone products.",
        });
      }

      if (images.length > 10) {
        return res.status(400).json({
          success: false,
          message: "Too many images",
          description: "Maximum 10 images allowed for standalone products.",
        });
      }
    }

    // Validate variants if product has variants
    if (hasVariants) {
      if (variants.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Variants are required",
          description: "At least one variant is required.",
        });
      }

      // Validate each variant
      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];

        if (!variant.colorId) {
          return res.status(400).json({
            success: false,
            message: `Variant ${i + 1}: Color is required`,
            description: "Each variant must have a color.",
          });
        }

        if (!variant.itemId || !variant.itemId.trim()) {
          return res.status(400).json({
            success: false,
            message: `Variant ${i + 1}: Item ID is required`,
            description: "Each variant must have an Item ID.",
          });
        }

        // Validate variant image (required, single image)
        if (!variant.image) {
          return res.status(400).json({
            success: false,
            message: `Variant ${i + 1}: Image is required`,
            description: "Each variant must have an image.",
          });
        }
      }
    }

    // Validate foreign key references using utility function
    const validationErrors = await validateForeignKeys({
      categoryIds,
      subCategoryIds,
      collectionIds,
      subCollectionIds,
      colorId,
    });

    if (validationErrors.length > 0) {
      const error = validationErrors[0];
      return res.status(400).json({
        success: false,
        message: error.message,
        description: error.description,
      });
    }

    // Standalone images were uploaded directly to Cloudinary; store their refs.
    let uploadedImages = [];
    if (isStandalone && images) {
      uploadedImages = normalizeImageRefs(images);
    }

    // Variants carry their already-uploaded image ref { publicId, url }.
    let processedVariants = [];
    if (hasVariants && variants) {
      try {
        processedVariants = variants.map((v) => ({
          colorId: v.colorId,
          secondaryColorId: v.secondaryColorId || undefined,
          itemId: v.itemId.trim(),
          stock:
            v.stock !== undefined && v.stock !== "" && v.stock !== null
              ? Number(v.stock)
              : 0,
          image: normalizeImageRef(v.image),
        }));
      } catch (error) {
        console.error("Variant image reference error:", error);
        return res.status(400).json({
          success: false,
          message: "Failed to save variant images",
          description: error.message,
        });
      }
    }

    // Calculate discount price if discount is provided
    const discountValue =
      discount !== undefined && discount !== null && discount !== ""
        ? Number(discount)
        : null;
    const discountPrice = discountValue
      ? calculateDiscountPrice(price, discountValue)
      : null;

    // Create product
    const productData = {
      productType: finalProductType,
      productName: productName.trim(),
      price: Number(price),
      descriptions: descriptions
        .filter((d) => d && d.trim())
        .map((d) => d.trim())
        .slice(0, 3),
      discount: discountValue,
      discountPrice: discountPrice,
      pieceCount:
        pieceCount !== undefined && pieceCount !== null && pieceCount !== ""
          ? Number(pieceCount)
          : null,
      length:
        length !== undefined && length !== null && length !== ""
          ? Number(length)
          : null,
      width:
        width !== undefined && width !== null && width !== ""
          ? Number(width)
          : null,
      height:
        height !== undefined && height !== null && height !== ""
          ? Number(height)
          : null,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      createdBy: req.user._id,
    };

    // Add optional fields
    if (categoryIds && categoryIds.length > 0) {
      productData.categoryIds = categoryIds;
    }
    if (subCategoryIds && subCategoryIds.length > 0) {
      productData.subCategoryIds = subCategoryIds;
    }
    if (collectionIds && collectionIds.length > 0) {
      productData.collectionIds = collectionIds;
    }
    if (subCollectionIds && subCollectionIds.length > 0) {
      productData.subCollectionIds = subCollectionIds;
    }

    if (
      skillLevelIds &&
      Array.isArray(skillLevelIds) &&
      skillLevelIds.length > 0
    ) {
      productData.skillLevelIds = skillLevelIds;
    }

    // Add standalone-specific fields
    if (isStandalone) {
      productData.partId = partId?.trim() ? partId.trim() : null;
      productData.itemId = itemId.trim();
      productData.images = uploadedImages;
      if (colorId) {
        productData.colorId = colorId;
      }
      if (secondaryColorId) {
        productData.secondaryColorId = secondaryColorId;
      }
      productData.stock =
        stock !== undefined && stock !== null && stock !== ""
          ? Number(stock)
          : 0;
      // Don't include variants field for standalone products
    } else {
      productData.variants = processedVariants;
      productData.partId = partId?.trim() ? partId.trim() : null;
    }

    const product = await Product.create(productData);

    // Populate references
    await product.populate(PRODUCT_DETAILS_POPULATE);

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: {
        id: product._id,
        productType: product.productType,
        productName: product.productName,
        price: product.price,
        discount: product.discount,
        discountPrice: product.discountPrice,
        descriptions: product.descriptions,
        ...(product.productType === "standalone" && {
          partId: product.partId,
          itemId: product.itemId,
          images: product.images,
          colorId: product.colorId,
          stock: product.stock,
        }),
        ...(product.productType === "variant" &&
          product.variants &&
          product.variants.length > 0 && {
            variants: product.variants,
          }),
        categoryIds: product.categoryIds,
        subCategoryIds: product.subCategoryIds,
        collectionIds: product.collectionIds,
        subCollectionIds: product.subCollectionIds,
        pieceCount: product.pieceCount,
        length: product.length,
        width: product.width,
        height: product.height,
        skillLevelIds: product.skillLevelIds,
        isActive: product.isActive,
        createdAt: product.createdAt,
      },
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create product",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get All Products ------------------------------------------
export const getAllProducts = async (req, res) => {
  try {
    // Extract and normalize pagination parameters
    const { page, limit, search } = normalizePagination(req.query);

    // Build search query using utility function
    const searchQuery = await buildProductSearchQuery(search);

    // Apply pagination
    const result = await paginateQuery(Product, searchQuery, {
      page,
      limit,
      sort: { createdAt: -1 },
      populate: PRODUCT_DETAILS_POPULATE_WITH_UPDATED,
    });

    // Filter out fields based on productType using utility function
    const processedProducts = result.data.map(filterProductByType);

    return res
      .status(200)
      .json(
        createPaginationResponse(
          { data: processedProducts, pagination: result.pagination },
          "products",
        ),
      );
  } catch (error) {
    console.error("Get all products error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get Single Product ------------------------------------------
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
        description: "Please provide a valid product ID.",
      });
    }

    const product = await Product.findById(id)
      .select("-__v")
      .populate("categoryIds", "categoryName")
      .populate("subCategoryIds", "subCategoryName")
      .populate("collectionIds", "collectionName")
      .populate("subCollectionIds", "subCollectionName")
      .populate("colorId", "colorName hexCode")
      .populate("secondaryColorId", "colorName hexCode")
      .populate("skillLevelIds", "skillLevelName")
      .populate("createdBy", "firstName lastName username")
      .populate("updatedBy", "firstName lastName username")
      .populate("variants.colorId", "colorName hexCode")
      .populate("variants.secondaryColorId", "colorName hexCode")
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
        description: "The requested product does not exist.",
      });
    }

    // Filter out fields based on productType using utility function
    const processedProduct = filterProductByType(product);

    return res.status(200).json({
      success: true,
      product: processedProduct,
    });
  } catch (error) {
    console.error("Get product by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Update Product ------------------------------------------
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      productName,
      productType, // "standalone" or "variant"
      partId,
      itemId,
      price,
      discount,
      descriptions,
      images, // For standalone products - array of base64 strings or existing image objects
      categoryIds,
      subCategoryIds,
      collectionIds,
      subCollectionIds,
      pieceCount,
      length,
      width,
      height,
      colorId,
      secondaryColorId, // For dual-color standalone products
      skillLevelIds,
      stock,
      isActive,
      variants,
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
        description: "Please provide a valid product ID.",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
        description: "The requested product does not exist.",
      });
    }

    // Determine product type - use provided productType or infer from variants
    const hasVariants =
      variants && Array.isArray(variants) && variants.length > 0;
    const inferredProductType = hasVariants
      ? "variant"
      : product.variants?.length > 0
        ? "variant"
        : "standalone";
    const finalProductType = productType || inferredProductType;

    // Validate productType if provided
    if (
      productType &&
      productType !== "standalone" &&
      productType !== "variant"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product type",
        description: "Product type must be either 'standalone' or 'variant'.",
      });
    }

    const isStandalone = finalProductType === "standalone";
    const isChangingToVariants =
      finalProductType === "variant" && product.productType === "standalone";
    const isChangingToStandalone =
      finalProductType === "standalone" && product.productType === "variant";

    // Validate required fields
    if (productName !== undefined && !productName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
        description: "Please provide a product name.",
      });
    }

    if (price !== undefined && price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid price is required",
        description: "Price must be a positive number.",
      });
    }

    if (descriptions !== undefined) {
      if (
        !Array.isArray(descriptions) ||
        descriptions.length === 0 ||
        !descriptions[0]?.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Description is required",
          description: "Please provide at least one description.",
        });
      }
      if (descriptions.length > 3) {
        return res.status(400).json({
          success: false,
          message: "Too many descriptions",
          description: "Maximum of 3 descriptions are allowed.",
        });
      }
    }

    // Validate standalone product fields if switching to standalone or updating standalone
    if (isStandalone || isChangingToStandalone) {
      if (itemId !== undefined && (!itemId || !itemId.trim())) {
        return res.status(400).json({
          success: false,
          message: "Item ID is required",
          description: "Item ID is required for standalone products.",
        });
      }

      const checkPartId = partId?.trim() ? partId.trim() : product.partId;
      const checkItemId = itemId ? itemId.trim() : product.itemId;

      if (checkPartId && checkItemId) {
        const existingProduct = await checkProductExists(
          checkPartId,
          checkItemId,
          id,
        );

        if (existingProduct) {
          return res.status(409).json({
            success: false,
            message: "Product already exists",
            description:
              "A product with this Part ID and Item ID already exists.",
          });
        }
      }
    }

    // Validate variants if product has variants
    if (hasVariants || product.variants?.length) {
      const variantsToValidate = hasVariants ? variants : product.variants;

      if (variantsToValidate.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Variants are required",
          description: "At least one variant is required.",
        });
      }

      // Validate each variant
      for (let i = 0; i < variantsToValidate.length; i++) {
        const variant = variantsToValidate[i];

        if (!variant.colorId) {
          return res.status(400).json({
            success: false,
            message: `Variant ${i + 1}: Color is required`,
            description: "Each variant must have a color.",
          });
        }

        if (!variant.itemId || !variant.itemId.trim()) {
          return res.status(400).json({
            success: false,
            message: `Variant ${i + 1}: Item ID is required`,
            description: "Each variant must have an Item ID.",
          });
        }
      }
    }

    // Standalone images arrive as uploaded refs; store them and clean up any
    // previously-stored images the admin dropped.
    let uploadedImages = [];

    if (isStandalone && images) {
      uploadedImages = normalizeImageRefs(images);
      cleanupRemovedImages(uploadedImages, product.images);
    }

    // Variant images also arrive as uploaded refs.
    let processedVariants = [];

    if (hasVariants || product.variants?.length) {
      const variantsToProcess = hasVariants ? variants : product.variants;

      try {
        processedVariants = variantsToProcess.map((v) => ({
          colorId: v.colorId,
          secondaryColorId: v.secondaryColorId || undefined,
          itemId: v.itemId.trim(),
          stock:
            v.stock !== undefined && v.stock !== "" && v.stock !== null
              ? Number(v.stock)
              : 0,
          image: normalizeImageRef(v.image),
        }));
      } catch (error) {
        console.error("Variant image reference error:", error);
        return res.status(400).json({
          success: false,
          message: "Failed to save variant images",
          description: error.message,
        });
      }

      // Delete variant images that were dropped from the set.
      cleanupRemovedImages(
        processedVariants.map((v) => v.image),
        (product.variants || []).map((v) => v.image),
      );

      // Clean up standalone images if switching to variants
      if (isChangingToVariants && product.images?.length > 0) {
        cleanupItemImages(product.images);
      }
    }

    // Calculate discount price if discount is provided
    let discountPrice = product.discountPrice;
    if (discount !== undefined) {
      const finalPrice = price !== undefined ? price : product.price;
      discountPrice =
        discount > 0 ? calculateDiscountPrice(finalPrice, discount) : null;
    } else if (price !== undefined && product.discount) {
      discountPrice = calculateDiscountPrice(price, product.discount);
    }

    // Update product fields
    if (productType !== undefined) {
      product.productType = finalProductType;
    }
    if (productName !== undefined) {
      product.productName = productName.trim();
    }
    if (price !== undefined) {
      product.price = Number(price);
    }
    if (discount !== undefined) {
      product.discount = discount > 0 ? Number(discount) : null;
      product.discountPrice = discountPrice;
    }
    if (descriptions !== undefined) {
      product.descriptions = descriptions
        .filter((d) => d && d.trim())
        .map((d) => d.trim())
        .slice(0, 3);
    }
    if (categoryIds !== undefined) {
      product.categoryIds = categoryIds;
    }
    if (subCategoryIds !== undefined) {
      product.subCategoryIds = subCategoryIds;
    }
    if (collectionIds !== undefined) {
      product.collectionIds = collectionIds;
    }
    if (subCollectionIds !== undefined) {
      product.subCollectionIds = subCollectionIds;
    }
    if (pieceCount !== undefined) {
      product.pieceCount =
        pieceCount !== null && pieceCount !== "" ? Number(pieceCount) : null;
    }
    if (length !== undefined) {
      product.length = length !== null && length !== "" ? Number(length) : null;
    }
    if (width !== undefined) {
      product.width = width !== null && width !== "" ? Number(width) : null;
    }
    if (height !== undefined) {
      product.height = height !== null && height !== "" ? Number(height) : null;
    }
    if (skillLevelIds !== undefined) {
      product.skillLevelIds = skillLevelIds;
    }
    if (isActive !== undefined) {
      product.isActive = Boolean(isActive);
    }
    product.updatedBy = req.user._id;

    // Handle standalone-specific fields
    if (isStandalone || isChangingToStandalone) {
      if (partId !== undefined) {
        product.partId = partId?.trim() ? partId.trim() : null;
      }
      if (itemId !== undefined) {
        product.itemId = itemId.trim();
      }
      if (images !== undefined) {
        product.images = uploadedImages;
      }
      if (colorId !== undefined) {
        product.colorId = colorId || null;
      }
      if (secondaryColorId !== undefined) {
        product.secondaryColorId = secondaryColorId || null;
      }
      if (stock !== undefined) {
        product.stock = Number(stock);
      }
      // Clear variants if switching to standalone
      if (isChangingToStandalone) {
        // Delete old variant images in background
        cleanupItemImages(product.variants);
        product.variants = undefined;
      }
    }

    // Handle variant-specific fields
    if (hasVariants || product.variants?.length) {
      if (variants !== undefined) {
        product.variants = processedVariants;
      }
      // Set partId at product level and clear standalone fields if switching to variants
      if (isChangingToVariants || (hasVariants && !isChangingToStandalone)) {
        // Delete old standalone images in background
        deleteMultipleImages((product.images || []).map((img) => img.publicId));
        if (partId !== undefined) {
          product.partId = partId?.trim() ? partId.trim() : null;
        }
        product.itemId = undefined;
        product.images = undefined;
        product.colorId = undefined;
        product.secondaryColorId = undefined;
        product.stock = undefined;
      }
    } else if (isStandalone || isChangingToStandalone) {
      // Ensure variants is removed for standalone products
      if (!product.variants || product.variants.length === 0) {
        product.variants = undefined;
      }
    }

    await product.save();

    await onProductToggle(product._id);

    // NOTE: Removed images are cleaned up above via cleanupRemovedImages
    // (fire-and-forget background deletes).

    // Populate references
    await product.populate(PRODUCT_DETAILS_POPULATE_WITH_UPDATED);

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: {
        id: product._id,
        productName: product.productName,
        price: product.price,
        discount: product.discount,
        discountPrice: product.discountPrice,
        descriptions: product.descriptions,
        productType: product.productType,
        ...(product.productType === "standalone" && {
          partId: product.partId,
          itemId: product.itemId,
          images: product.images,
          colorId: product.colorId,
          stock: product.stock,
        }),
        ...(product.productType === "variant" &&
          product.variants &&
          product.variants.length > 0 && {
            variants: product.variants,
          }),
        categoryIds: product.categoryIds,
        subCategoryIds: product.subCategoryIds,
        collectionIds: product.collectionIds,
        subCollectionIds: product.subCollectionIds,
        pieceCount: product.pieceCount,
        length: product.length,
        width: product.width,
        height: product.height,
        skillLevelIds: product.skillLevelIds,
        isActive: product.isActive,
        updatedAt: product.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update product",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Delete Product ------------------------------------------
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
        description: "Please provide a valid product ID.",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
        description: "The requested product does not exist.",
      });
    }

    await Product.findByIdAndDelete(id);

    // Delete all images in background (fire-and-forget)
    cleanupItemImages(product.images);
    cleanupItemImages(product.variants);

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete product",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Public Product Controllers ------------------------------------------

// Get all public products (minimal fields for listing)
export const getPublicProducts = async (req, res) => {
  try {
    // Validate and normalize pagination parameters
    const validatedLimit = validatePublicProductLimit(req.query.limit);
    const { page, search } = normalizePagination({
      page: req.query.page,
      limit: validatedLimit,
      search: req.query.search,
    });
    const limit = validatedLimit;

    // Validate price parameters
    const priceValidation = validatePriceParams(
      req.query.priceMin,
      req.query.priceMax,
    );
    if (!priceValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid price range",
        description: priceValidation.error,
      });
    }

    // Validate and filter IDs
    const validatedCategoryIds = validateAndFilterIds(
      req.query.categoryIds?.split(",").filter(Boolean),
    );
    const validatedSubCategoryIds = validateAndFilterIds(
      req.query.subCategoryIds?.split(",").filter(Boolean),
    );
    const validatedCollectionIds = validateAndFilterIds(
      req.query.collectionIds?.split(",").filter(Boolean),
    );
    const validatedSubCollectionIds = validateAndFilterIds(
      req.query.subCollectionIds?.split(",").filter(Boolean),
    );
    const validatedColorIds = validateAndFilterIds(
      req.query.colorIds?.split(",").filter(Boolean),
    );
    const validatedSkillLevelIds = validateAndFilterIds(
      req.query.skillLevelIds?.split(",").filter(Boolean),
    );

    // Build query using utility function
    const query = await buildPublicProductQuery({
      search,
      priceMin: priceValidation.priceMin,
      priceMax: priceValidation.priceMax,
      categoryIds:
        validatedCategoryIds.length > 0
          ? validatedCategoryIds.join(",")
          : undefined,
      subCategoryIds:
        validatedSubCategoryIds.length > 0
          ? validatedSubCategoryIds.join(",")
          : undefined,
      collectionIds:
        validatedCollectionIds.length > 0
          ? validatedCollectionIds.join(",")
          : undefined,
      subCollectionIds:
        validatedSubCollectionIds.length > 0
          ? validatedSubCollectionIds.join(",")
          : undefined,
      colorIds:
        validatedColorIds.length > 0 ? validatedColorIds.join(",") : undefined,
      skillLevelIds:
        validatedSkillLevelIds.length > 0
          ? validatedSkillLevelIds.join(",")
          : undefined,
    });

    // Validate and get sort parameter
    const sortBy = validateSortBy(req.query.sortBy);
    const sort = buildSortObject(sortBy);

    // Apply pagination with minimal field selection
    const skip = (page - 1) * limit;

    // Build query with shared select and populate
    const mongooseQuery = applyPublicPopulate(
      Product.find(query)
        .select(PUBLIC_LISTING_SELECT)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
    );

    // Execute queries in parallel
    const [totalItems, products] = await Promise.all([
      Product.countDocuments(query),
      mongooseQuery.exec(),
    ]);

    const processedProducts = processProductsForListing(
      products,
      validatedColorIds,
    );
    const totalPages = Math.ceil(totalItems / limit);

    return res.status(200).json({
      success: true,
      products: processedProducts,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get public products error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

// Get single public product (full details for detail page)
export const getPublicProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
        description: "Please provide a valid product ID.",
      });
    }

    const product = await applyPublicPopulate(
      Product.findOne({ _id: id, isVisible: true })
        .select("-__v -createdBy -updatedBy")
        .lean(),
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
        description:
          "The requested product does not exist or is not available.",
      });
    }

    const processedProduct = processProductForDetails(product);

    return res.status(200).json({
      success: true,
      product: processedProduct,
    });
  } catch (error) {
    console.error("Get public product by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------- Get Related Products ----------------------------------------------------
export const getPublicRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = DEFAULT_PUBLIC_PRODUCT_LIMIT;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
        description: "Please provide a valid product ID.",
      });
    }

    // Fetch current product to extract taxonomy and name
    const currentProduct = await Product.findOne({ _id: id, isVisible: true })
      .select(
        "productName categoryIds subCategoryIds collectionIds subCollectionIds",
      )
      .lean();

    if (!currentProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
        description:
          "The requested product does not exist or is not available.",
      });
    }

    const baseFilter = { _id: { $ne: id }, isVisible: true };
    const collectedIds = new Set();
    let relatedProducts = [];

    // Helper: fetch products matching a query, excluding already collected IDs
    const fetchProducts = async (filter, remaining) => {
      if (remaining <= 0) return [];
      const excludeIds = [...collectedIds].map(
        (sid) => new mongoose.Types.ObjectId(sid),
      );
      const combinedFilter = {
        ...filter,
        _id: { $ne: id, $nin: excludeIds },
      };

      return applyPublicPopulate(
        Product.find(combinedFilter)
          .select(PUBLIC_LISTING_SELECT)
          .sort({ createdAt: -1 })
          .limit(remaining)
          .lean(),
      ).exec();
    };

    const addProducts = (products) => {
      for (const p of products) {
        collectedIds.add(p._id.toString());
      }
      relatedProducts = [...relatedProducts, ...products];
    };

    // Priority 1: Same sub-collection
    if (
      relatedProducts.length < limit &&
      currentProduct.subCollectionIds?.length > 0
    ) {
      const subCollectionMatches = await fetchProducts(
        {
          ...baseFilter,
          subCollectionIds: { $in: currentProduct.subCollectionIds },
        },
        limit - relatedProducts.length,
      );
      addProducts(subCollectionMatches);
    }

    // Priority 2: Same collection
    if (
      relatedProducts.length < limit &&
      currentProduct.collectionIds?.length > 0
    ) {
      const collectionMatches = await fetchProducts(
        {
          ...baseFilter,
          collectionIds: { $in: currentProduct.collectionIds },
        },
        limit - relatedProducts.length,
      );
      addProducts(collectionMatches);
    }

    // Priority 3: Same sub-category
    if (
      relatedProducts.length < limit &&
      currentProduct.subCategoryIds?.length > 0
    ) {
      const subCategoryMatches = await fetchProducts(
        {
          ...baseFilter,
          subCategoryIds: { $in: currentProduct.subCategoryIds },
        },
        limit - relatedProducts.length,
      );
      addProducts(subCategoryMatches);
    }

    // Priority 4: Same category
    if (
      relatedProducts.length < limit &&
      currentProduct.categoryIds?.length > 0
    ) {
      const categoryMatches = await fetchProducts(
        {
          ...baseFilter,
          categoryIds: { $in: currentProduct.categoryIds },
        },
        limit - relatedProducts.length,
      );
      addProducts(categoryMatches);
    }

    // Priority 5: Similar name (match products sharing any significant word)
    if (currentProduct.productName) {
      const words = currentProduct.productName
        .split(/\s+/)
        .filter(
          (w) =>
            w.length > 2 && !NAME_MATCH_GENERIC_WORDS.includes(w.toLowerCase()),
        )
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); // Escape regex chars

      if (words.length > 0) {
        const nameRegex = words.join("|"); // OR: match any word
        const similarName = await fetchProducts(
          {
            ...baseFilter,
            productName: { $regex: nameRegex, $options: "i" },
          },
          limit,
        );
        addProducts(similarName);
      }
    }

    // Priority 6: General fallback - latest products
    if (relatedProducts.length < limit) {
      const latestProducts = await fetchProducts(
        baseFilter,
        limit - relatedProducts.length,
      );
      addProducts(latestProducts);
    }

    const processedProducts = processProductsForListing(relatedProducts);

    return res.status(200).json({
      success: true,
      products: processedProducts,
    });
  } catch (error) {
    console.error("Get public related products error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch related products",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

// Get public categories with nested subcategories and product counts
export const getPublicCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: { $ne: false } })
      .select("_id categoryName")
      .sort({ categoryName: 1 })
      .lean();

    const subCategories = await SubCategory.find({ isActive: { $ne: false } })
      .select("_id subCategoryName categoryId")
      .sort({ subCategoryName: 1 })
      .lean();

    // Get counts using utility function
    const { categoryCountMap, subCategoryCountMap } = await getCategoryCounts();

    // Nest subcategories under their parent categories
    const categoriesWithSubs = categories.map((category) => {
      const subCats = subCategories
        .filter((sub) => sub.categoryId.toString() === category._id.toString())
        .map(({ _id, subCategoryName }) => ({
          _id,
          subCategoryName,
          count: subCategoryCountMap.get(_id.toString()) || 0,
        }));

      return {
        _id: category._id,
        categoryName: category.categoryName,
        count: categoryCountMap.get(category._id.toString()) || 0,
        subCategories: subCats,
      };
    });

    return res.status(200).json({
      success: true,
      categories: categoriesWithSubs,
    });
  } catch (error) {
    console.error("Get public categories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

// Get public collections with nested subcollections and product counts
export const getPublicCollections = async (req, res) => {
  try {
    const collections = await Collection.find({ isActive: { $ne: false } })
      .select("_id collectionName description image isFeatured createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const subCollections = await SubCollection.find({
      isActive: { $ne: false },
    })
      .select("_id subCollectionName image collectionId createdAt")
      .sort({ createdAt: -1 })
      .lean();

    // Get counts using utility function
    const { collectionCountMap, subCollectionCountMap } =
      await getCollectionCounts();

    // Nest subcollections under their parent collections
    const collectionsWithSubs = collections.map((collection) => {
      const subCols = subCollections
        .filter(
          (sub) => sub.collectionId.toString() === collection._id.toString(),
        )
        .map(({ _id, subCollectionName, image }) => ({
          _id,
          subCollectionName,
          image,
          count: subCollectionCountMap.get(_id.toString()) || 0,
        }));

      return {
        _id: collection._id,
        collectionName: collection.collectionName,
        description: collection.description,
        image: collection.image,
        isFeatured: collection.isFeatured,
        count: collectionCountMap.get(collection._id.toString()) || 0,
        subCollections: subCols,
      };
    });

    return res.status(200).json({
      success: true,
      collections: collectionsWithSubs,
    });
  } catch (error) {
    console.error("Get public collections error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch collections",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

// Get public colors with product counts
export const getPublicColors = async (req, res) => {
  try {
    const colors = await Color.find({ isActive: { $ne: false } })
      .select("_id colorName hexCode")
      .sort({ colorName: 1 })
      .lean();

    // Get counts using utility function
    const colorCountMap = await getColorCounts();

    // Add counts to colors
    const colorsWithCounts = colors.map((color) => ({
      ...color,
      count: colorCountMap.get(color._id.toString()) || 0,
    }));

    return res.status(200).json({
      success: true,
      colors: colorsWithCounts,
    });
  } catch (error) {
    console.error("Get public colors error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch colors",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

// Get public skill levels with product counts
export const getPublicSkillLevels = async (req, res) => {
  try {
    const skillLevels = await SkillLevel.find({ isActive: { $ne: false } })
      .select("_id skillLevelName")
      .sort({ skillLevelName: 1 })
      .lean();

    // Get counts using utility function
    const skillLevelCountMap = await getSkillLevelCounts();

    // Add counts to skill levels
    const skillLevelsWithCounts = skillLevels.map((skillLevel) => ({
      ...skillLevel,
      count: skillLevelCountMap.get(skillLevel._id.toString()) || 0,
    }));

    return res.status(200).json({
      success: true,
      skillLevels: skillLevelsWithCounts,
    });
  } catch (error) {
    console.error("Get public skill levels error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch skill levels",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};
