import Bundle from "../models/bundle.model.js";
import DealerAddon from "../models/dealerAddon.model.js";
import DealerExtraBag from "../models/dealerExtraBag.model.js";
import DealerTorsoBag from "../models/dealerTorsoBag.model.js";
import GeneralInventory from "../models/generalInventory.model.js";
import SubCollection from "../models/subCollection.model.js";
import {
  cleanupItemImages,
  uploadSingleImage,
  replaceSingleImage,
  deleteSingleImage,
} from "../services/imageService.js";

const ADDON_IMAGE_FOLDER = "world-of-minifigs-v2/dealers/add-ons";

// Single source of truth for upgrade pricing.
// Returns { price, discount, discountPrice } where discountPrice is derived.
// `discount` is treated as a percentage (0–100); `null` means "no discount".
const computeUpgradePricing = (rawPrice, rawDiscount) => {
  const price = Number(rawPrice) || 0;

  const hasDiscount =
    rawDiscount !== undefined &&
    rawDiscount !== null &&
    String(rawDiscount).trim() !== "";

  if (!hasDiscount) {
    return { price, discount: null, discountPrice: null };
  }

  const pct = Math.min(100, Math.max(0, Number(rawDiscount)));
  const discountPrice = Math.max(0, price * (1 - pct / 100));
  return { price, discount: pct, discountPrice };
};

// Resolve the per-order purchase policy for an upgrade add-on. Returns either
// `{ quantityMode, maxQuantity }` or `{ error }` for the caller to forward.
// `maxQuantity` is only stored for the "limited" mode; the others null it out.
const resolveAddonQuantityPolicy = (rawMode, rawMax) => {
  const mode = ["single", "limited", "unlimited"].includes(rawMode)
    ? rawMode
    : "single";

  if (mode !== "limited") {
    return { quantityMode: mode, maxQuantity: null };
  }

  const max = Math.floor(Number(rawMax));
  if (!Number.isFinite(max) || max < 1) {
    return {
      error: {
        status: 400,
        success: false,
        message: "Invalid max quantity",
        description:
          'A "limited" add-on needs a maximum quantity of at least 1.',
      },
    };
  }

  return { quantityMode: "limited", maxQuantity: max };
};

// Resolve the optional finite stock for an upgrade add-on. Returns either
// `{ stock }` (null = untracked) or `{ error }`. Empty input clears tracking.
const resolveAddonStock = (raw) => {
  if (raw === "" || raw === null || raw === undefined) {
    return { stock: null };
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    return {
      error: {
        status: 400,
        success: false,
        message: "Invalid stock",
        description: "Stock must be a whole number of 0 or more.",
      },
    };
  }
  return { stock: n };
};
import {
  normalizePagination,
  buildSearchQuery,
  paginateQuery,
  createPaginationResponse,
} from "../utils/pagination.js";
import { handleError, checkNameConflict } from "../utils/commonUtils.js";
import { validateFeatures, processFeatures } from "../utils/bundleUtils.js";
import { AUDIT_POPULATE } from "../utils/populateHelpers.js";
import {
  checkBundleQuantityConflict,
  findBundleByIdAndType,
} from "../utils/bundleUtils.js";
import {
  getBundleMiscQuantity,
  validateTorsoItems,
  checkTorsoBagNameConflict,
  processTorsoBagItems,
  processTorsoBagItemsForUpdate,
} from "../services/bundleService.js";

// Dealer bundles must use one of these two base torso-bag sizes.
const VALID_BASE_SIZES = [100, 500];

// Add-on sales channels. Dealer and wholesale share one add-on list and the
// same GeneralInventory stock; visibility per channel is controlled by the
// `visibleChannels` array on each add-on (and on each bundle item).
const ADDON_CHANNELS = ["dealer", "wholesale"];

// Normalize an arbitrary channel input to a known value (defaults to dealer).
const normalizeAddonChannel = (raw) =>
  raw === "wholesale" ? "wholesale" : "dealer";

// Validate and clean a visibleChannels array: keep only known channels,
// de-duplicate, and require at least one. `fallback` is used when the input is
// missing entirely (undefined). Returns { isValid, channels?, error? }.
const sanitizeVisibleChannels = (raw, fallback) => {
  if (raw === undefined) return { isValid: true, channels: fallback };

  if (!Array.isArray(raw)) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: "Invalid channels",
        description: "Channels must be a list of 'dealer' and/or 'wholesale'.",
      },
    };
  }

  const cleaned = [...new Set(raw)].filter((c) => ADDON_CHANNELS.includes(c));
  if (cleaned.length === 0) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: "Channel required",
        description: "Select at least one channel (dealer or wholesale).",
      },
    };
  }

  return { isValid: true, channels: cleaned };
};

// Build the Mongo filter for a public read on a channel. Add-ons missing
// visibleChannels (legacy, pre-migration) are treated as dealer-only.
const buildAddonChannelFilter = (channel) =>
  normalizeAddonChannel(channel) === "wholesale"
    ? { visibleChannels: "wholesale" }
    : {
        $or: [
          { visibleChannels: "dealer" },
          { visibleChannels: { $exists: false } },
        ],
      };

const validateBaseSize = (baseSize, minifigQuantity) => {
  const base = Number(baseSize);
  if (!VALID_BASE_SIZES.includes(base)) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: "Invalid base size",
        description: "Base size must be either 100 or 500.",
      },
    };
  }
  if (Number(minifigQuantity) % base !== 0) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: "Invalid bundle size",
        description: `Bundle quantity (${minifigQuantity}) must be a multiple of the base size (${base}).`,
      },
    };
  }
  return { isValid: true, baseSize: base };
};

// -------------------------------- Helper Functions ----------------------------------

const findDealerBundleById = async (id) => findBundleByIdAndType("dealer", id);

const checkBundleConflict = async (minifigQuantity, excludeId = null) =>
  checkBundleQuantityConflict("dealer", minifigQuantity, excludeId);

const checkExtraBagConflict = async (subCollectionId, excludeId = null) => {
  const query = { subCollectionId };
  if (excludeId) query._id = { $ne: excludeId };
  return DealerExtraBag.findOne(query);
};

const getStandardPopulateOptions = () => AUDIT_POPULATE;

const validateAddonBundleItems = async (bundleItems) => {
  if (!bundleItems || !Array.isArray(bundleItems) || bundleItems.length === 0) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: "Bundle items are required",
        description: "Please add at least one inventory item to the bundle.",
      },
    };
  }

  const itemIds = bundleItems.map((i) => i.inventoryItemId);
  if (new Set(itemIds).size !== itemIds.length) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: "Duplicate items found",
        description: "Each inventory item can only appear once in a bundle.",
      },
    };
  }

  const validatedItems = [];

  for (const item of bundleItems) {
    if (!item.inventoryItemId) {
      return {
        isValid: false,
        error: {
          status: 400,
          message: "Inventory item is required",
          description: "Each bundle item must reference an inventory item.",
        },
      };
    }

    const inventoryItem = await GeneralInventory.findById(
      item.inventoryItemId,
    ).lean();
    if (!inventoryItem) {
      return {
        isValid: false,
        error: {
          status: 404,
          message: "Inventory item not found",
          description: `The inventory item "${item.inventoryItemId}" does not exist.`,
        },
      };
    }

    validatedItems.push({ inventoryItemId: item.inventoryItemId });
  }

  return { isValid: true, validatedItems };
};

// -------------------------------- Create Dealer Bundle ----------------------------------

export const createDealerBundle = async (req, res) => {
  try {
    const {
      bundleName,
      minifigQuantity,
      totalPrice,
      baseSize,
      features,
      isActive,
    } = req.body;

    // Validate features
    const featuresValidation = validateFeatures(features);
    if (!featuresValidation.isValid) {
      return res
        .status(featuresValidation.error.status)
        .json(featuresValidation.error);
    }

    // Validate required fields
    if (!bundleName) {
      return res.status(400).json({
        success: false,
        message: "Bundle name is required",
        description: "Please provide a name for the bundle.",
      });
    }

    if (!minifigQuantity || minifigQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Valid quantity is required",
        description: "Quantity must be at least 1 minifig.",
      });
    }

    const baseSizeValidation = validateBaseSize(baseSize, minifigQuantity);
    if (!baseSizeValidation.isValid) {
      return res
        .status(baseSizeValidation.error.status)
        .json(baseSizeValidation.error);
    }

    // Check for existing bundle with same quantity
    const existingBundle = await checkBundleConflict(minifigQuantity);
    if (existingBundle) {
      return res.status(409).json({
        success: false,
        message: "Bundle already exists",
        description: `A dealer bundle with ${minifigQuantity} minifigs already exists.`,
      });
    }

    const unitPrice = totalPrice / minifigQuantity;

    const bundleData = {
      bundleName: bundleName.trim(),
      bundleType: "dealer",
      minifigQuantity,
      unitPrice,
      totalPrice,
      baseSize: baseSizeValidation.baseSize,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
    };

    // Only include features if it's a non-empty array
    const processedFeatures = processFeatures(features);
    if (processedFeatures) {
      bundleData.features = processedFeatures;
    }

    const bundle = await Bundle.create(bundleData);

    return res.status(201).json({
      success: true,
      message: "Bundle created successfully",
      description: `The "${bundle.bundleName}" bundle has been added to dealer options.`,
      bundle,
    });
  } catch (error) {
    handleError(res, error, "Create dealer bundle", "Failed to create bundle");
  }
};

// -------------------------------- Get All Dealer Bundles ----------------------------------

export const getAllDealerBundles = async (req, res) => {
  try {
    const { page, limit, search } = normalizePagination(req.query);

    const searchQuery = {
      bundleType: "dealer",
      ...buildSearchQuery(search, ["bundleName"]),
    };

    const result = await paginateQuery(Bundle, searchQuery, {
      page,
      limit,
      populate: getStandardPopulateOptions(),
    });

    return res.status(200).json(createPaginationResponse(result, "bundles"));
  } catch (error) {
    handleError(res, error, "Get dealer bundles", "Failed to fetch bundles");
  }
};

// -------------------------------- Update Dealer Bundle ----------------------------------

export const updateDealerBundle = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      bundleName,
      minifigQuantity,
      totalPrice,
      baseSize,
      features,
      isActive,
    } = req.body;

    // Validate features
    const featuresValidation = validateFeatures(features);
    if (!featuresValidation.isValid) {
      return res
        .status(featuresValidation.error.status)
        .json(featuresValidation.error);
    }

    // Find bundle
    const bundle = await findDealerBundleById(id);
    if (!bundle) {
      return res.status(404).json({
        success: false,
        message: "Bundle not found",
        description: "The requested dealer bundle does not exist.",
      });
    }

    // Update fields
    if (bundleName) bundle.bundleName = bundleName.trim();

    if (minifigQuantity !== undefined) {
      if (minifigQuantity !== bundle.minifigQuantity) {
        const conflict = await checkBundleConflict(minifigQuantity, id);
        if (conflict) {
          return res.status(409).json({
            success: false,
            message: "Quantity conflict",
            description: `Another dealer bundle with ${minifigQuantity} minifigs already exists.`,
          });
        }
      }
      bundle.minifigQuantity = minifigQuantity;
    }

    if (totalPrice !== undefined) bundle.totalPrice = totalPrice;

    if (baseSize !== undefined) {
      const baseSizeValidation = validateBaseSize(
        baseSize,
        bundle.minifigQuantity,
      );
      if (!baseSizeValidation.isValid) {
        return res
          .status(baseSizeValidation.error.status)
          .json(baseSizeValidation.error);
      }
      bundle.baseSize = baseSizeValidation.baseSize;
    }

    if (features !== undefined) {
      const processedFeatures = processFeatures(features);
      bundle.features = processedFeatures;
    }

    if (isActive !== undefined) bundle.isActive = isActive;

    // Recalculate unit price
    bundle.unitPrice = bundle.totalPrice / bundle.minifigQuantity;
    bundle.updatedBy = req.user._id;

    await bundle.save();

    return res.status(200).json({
      success: true,
      message: "Bundle updated successfully",
      description: `The "${bundle.bundleName}" bundle has been successfully updated.`,
      bundle,
    });
  } catch (error) {
    handleError(res, error, "Update dealer bundle", "Failed to update bundle");
  }
};

// -------------------------------- Delete Dealer Bundle ----------------------------------

export const deleteDealerBundle = async (req, res) => {
  try {
    const { id } = req.params;
    const bundle = await Bundle.findOneAndDelete({
      _id: id,
      bundleType: "dealer",
    });

    if (!bundle) {
      return res.status(404).json({
        success: false,
        message: "Bundle not found",
        description: "The requested dealer bundle does not exist.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bundle deleted successfully",
      description: `The bundle has been removed from dealer options.`,
    });
  } catch (error) {
    handleError(res, error, "Delete dealer bundle", "Failed to delete bundle");
  }
};

// -------------------------------- Create Dealer Addon ----------------------------------

export const createDealerAddon = async (req, res) => {
  try {
    const {
      addonName,
      addonType,
      visibleChannels,
      description,
      price,
      discount,
      quantityMode,
      maxQuantity,
      stock,
      badge,
      bundleItems,
      image,
      isActive,
    } = req.body;

    if (!addonName || !addonName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Add-on name is required",
        description: "Please provide a name for the add-on.",
      });
    }

    if (!addonType || !["bundle", "upgrade"].includes(addonType)) {
      return res.status(400).json({
        success: false,
        message: "Valid add-on type is required",
        description: 'Please select either "Bundle" or "Upgrade".',
      });
    }

    // Which channels this add-on shows on (defaults to both channels).
    const channelsResult = sanitizeVisibleChannels(visibleChannels, [
      "dealer",
      "wholesale",
    ]);
    if (!channelsResult.isValid) {
      return res.status(channelsResult.error.status).json(channelsResult.error);
    }

    // Check name uniqueness (one add-on per name across all channels)
    const existing = await checkNameConflict(
      DealerAddon,
      "addonName",
      addonName.trim(),
    );
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Add-on already exists",
        description: `An add-on named "${addonName}" already exists.`,
      });
    }

    const addonData = {
      addonName: addonName.trim(),
      addonType,
      visibleChannels: channelsResult.channels,
      description: description?.trim() || undefined,
      price: 0,
      discount: null,
      discountPrice: null,
      quantityMode: "single",
      maxQuantity: null,
      stock: null,
      badge: badge?.trim() || null,
      bundleItems: [],
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
    };

    if (addonType === "bundle") {
      const validation = await validateAddonBundleItems(bundleItems);
      if (!validation.isValid) {
        return res.status(validation.error.status).json(validation.error);
      }

      addonData.bundleItems = validation.validatedItems;
      addonData.price = 0; // Price set on individual items for bundles
    } else {
      // Upgrade
      if (price !== undefined && price !== null && Number(price) < 0) {
        return res.status(400).json({
          success: false,
          message: "Valid price is required",
          description: "Upgrade price cannot be negative.",
        });
      }

      const pricing = computeUpgradePricing(price, discount);
      addonData.price = pricing.price;
      addonData.discount = pricing.discount;
      addonData.discountPrice = pricing.discountPrice;

      const policy = resolveAddonQuantityPolicy(quantityMode, maxQuantity);
      if (policy.error) {
        return res.status(policy.error.status).json(policy.error);
      }
      addonData.quantityMode = policy.quantityMode;
      addonData.maxQuantity = policy.maxQuantity;

      const stockResult = resolveAddonStock(stock);
      if (stockResult.error) {
        return res.status(stockResult.error.status).json(stockResult.error);
      }
      addonData.stock = stockResult.stock;
    }

    // Optional image upload
    if (image) {
      try {
        addonData.image = await uploadSingleImage(image, ADDON_IMAGE_FOLDER);
      } catch (error) {
        console.error("Addon image upload error:", error);
        return res.status(400).json({
          success: false,
          message: "Failed to upload image",
          description: error.message,
        });
      }
    }

    const addon = await DealerAddon.create(addonData);

    return res.status(201).json({
      success: true,
      message: "Add-on created successfully",
      description: `The "${addon.addonName}" add-on has been created.`,
      addon,
    });
  } catch (error) {
    handleError(res, error, "Create dealer addon", "Failed to create add-on");
  }
};

// -------------------------------- Get All Dealer Addons ----------------------------------

export const getAllDealerAddons = async (req, res) => {
  try {
    const { page, limit, search } = normalizePagination(req.query);

    const searchQuery = buildSearchQuery(search, ["addonName", "description"]);

    const result = await paginateQuery(DealerAddon, searchQuery, {
      page,
      limit,
      sort: { createdAt: -1 },
      populate: [
        {
          path: "bundleItems.inventoryItemId",
          select:
            "minifigName pricePerBag piecesPerBag stock image colorId isActive category collectionId partType",
          populate: { path: "colorId", select: "colorName hexCode" },
        },
        ...getStandardPopulateOptions(),
      ],
    });

    return res.status(200).json(createPaginationResponse(result, "addons"));
  } catch (error) {
    handleError(res, error, "Get dealer addons", "Failed to fetch add-ons");
  }
};

// -------------------------------- Update Dealer Addon ----------------------------------

export const updateDealerAddon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      addonName,
      visibleChannels,
      description,
      price,
      discount,
      quantityMode,
      maxQuantity,
      stock,
      badge,
      bundleItems,
      image,
      isActive,
    } = req.body;

    const addon = await DealerAddon.findById(id);

    if (!addon) {
      return res.status(404).json({
        success: false,
        message: "Add-on not found",
        description: "The requested add-on does not exist.",
      });
    }

    // Update name with uniqueness check (one add-on per name)
    if (addonName !== undefined) {
      const trimmed = addonName.trim();
      if (!trimmed) {
        return res.status(400).json({
          success: false,
          message: "Add-on name is required",
          description: "Please provide a name for the add-on.",
        });
      }

      const conflict = await checkNameConflict(
        DealerAddon,
        "addonName",
        trimmed,
        id,
      );
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: "Add-on already exists",
          description: `An add-on named "${trimmed}" already exists.`,
        });
      }

      addon.addonName = trimmed;
    }

    if (description !== undefined)
      addon.description = description?.trim() || undefined;
    if (badge !== undefined) addon.badge = badge?.trim() || null;
    if (isActive !== undefined) addon.isActive = isActive;

    if (visibleChannels !== undefined) {
      const channelsResult = sanitizeVisibleChannels(visibleChannels);
      if (!channelsResult.isValid) {
        return res
          .status(channelsResult.error.status)
          .json(channelsResult.error);
      }
      addon.visibleChannels = channelsResult.channels;
    }

    // Type-specific updates (type cannot be changed)
    if (addon.addonType === "bundle") {
      if (bundleItems !== undefined) {
        const validation = await validateAddonBundleItems(bundleItems);
        if (!validation.isValid) {
          return res.status(validation.error.status).json(validation.error);
        }

        addon.bundleItems = validation.validatedItems;
        addon.price = 0; // Price set on individual items for bundles
      }
    } else {
      // Upgrade — recompute discountPrice whenever price or discount changes
      if (price !== undefined && price !== null && Number(price) < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid price",
          description: "Price cannot be negative.",
        });
      }

      if (price !== undefined || discount !== undefined) {
        const nextPrice = price !== undefined ? price : addon.price;
        const nextDiscount = discount !== undefined ? discount : addon.discount;
        const pricing = computeUpgradePricing(nextPrice, nextDiscount);
        addon.price = pricing.price;
        addon.discount = pricing.discount;
        addon.discountPrice = pricing.discountPrice;
      }

      if (quantityMode !== undefined || maxQuantity !== undefined) {
        const nextMode =
          quantityMode !== undefined ? quantityMode : addon.quantityMode;
        const nextMax =
          maxQuantity !== undefined ? maxQuantity : addon.maxQuantity;
        const policy = resolveAddonQuantityPolicy(nextMode, nextMax);
        if (policy.error) {
          return res.status(policy.error.status).json(policy.error);
        }
        addon.quantityMode = policy.quantityMode;
        addon.maxQuantity = policy.maxQuantity;
      }

      if (stock !== undefined) {
        const stockResult = resolveAddonStock(stock);
        if (stockResult.error) {
          return res.status(stockResult.error.status).json(stockResult.error);
        }
        addon.stock = stockResult.stock;
      }
    }

    // Replace image if provided
    if (image) {
      try {
        const uploaded = await replaceSingleImage(
          image,
          addon.image,
          ADDON_IMAGE_FOLDER,
        );
        if (uploaded) addon.image = uploaded;
      } catch (error) {
        console.error("Addon image update error:", error);
        return res.status(400).json({
          success: false,
          message: "Failed to update image",
          description: error.message,
        });
      }
    } else if (image === null) {
      // Explicit removal
      if (addon.image?.publicId) deleteSingleImage(addon.image.publicId);
      addon.image = undefined;
    }

    addon.updatedBy = req.user._id;
    await addon.save();

    await addon.populate([
      {
        path: "bundleItems.inventoryItemId",
        select:
          "minifigName pricePerBag piecesPerBag stock image colorId category collectionId partType",
        populate: { path: "colorId", select: "colorName hexCode" },
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Add-on updated successfully",
      description: `The "${addon.addonName}" add-on has been updated.`,
      addon,
    });
  } catch (error) {
    handleError(res, error, "Update dealer addon", "Failed to update add-on");
  }
};

// -------------------------------- Delete Dealer Addon ----------------------------------

export const deleteDealerAddon = async (req, res) => {
  try {
    const { id } = req.params;
    const addon = await DealerAddon.findByIdAndDelete(id);

    if (!addon) {
      return res.status(404).json({
        success: false,
        message: "Add-on not found",
        description: "The requested add-on does not exist.",
      });
    }

    // Clean up Cloudinary image (fire-and-forget)
    if (addon.image?.publicId) deleteSingleImage(addon.image.publicId);

    return res.status(200).json({
      success: true,
      message: "Add-on deleted successfully",
      description: `The "${addon.addonName}" add-on has been removed.`,
    });
  } catch (error) {
    handleError(res, error, "Delete dealer addon", "Failed to delete add-on");
  }
};

// ------------------------------- Create Dealer Extra Bag ----------------------------------

export const createDealerExtraBag = async (req, res) => {
  try {
    const { subCollectionId, price, isActive } = req.body;

    // Validate required fields
    if (!subCollectionId) {
      return res.status(400).json({
        success: false,
        message: "Sub-collection ID is required",
        description: "Please select a part category.",
      });
    }

    // Check for existing extra bag with same sub-collection
    const existing = await checkExtraBagConflict(subCollectionId);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Price already set",
        description: "Pricing for this part category has already been defined.",
      });
    }

    const extraBag = await DealerExtraBag.create({
      subCollectionId,
      price,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Bag pricing set successfully",
      description: "Extra bag pricing has been added for this category.",
      extraBag,
    });
  } catch (error) {
    handleError(
      res,
      error,
      "Create dealer extra bag",
      "Failed to set bag pricing",
    );
  }
};

// ------------------------------- Get All Dealer Extra Bags --------------------------------

export const getAllDealerExtraBags = async (req, res) => {
  try {
    const { page, limit, search } = normalizePagination(req.query);

    const searchQuery = {};

    if (search) {
      // Find sub-collections matching the search name
      const matchingSubCollections = await SubCollection.find({
        subCollectionName: { $regex: search, $options: "i" },
      }).select("_id");

      const subCollectionIds = matchingSubCollections.map((sc) => sc._id);
      searchQuery.subCollectionId = { $in: subCollectionIds };
    }

    const result = await paginateQuery(DealerExtraBag, searchQuery, {
      page,
      limit,
      populate: [
        { path: "subCollectionId", select: "subCollectionName" },
        ...getStandardPopulateOptions(),
      ],
    });

    return res.status(200).json(createPaginationResponse(result, "extraBags"));
  } catch (error) {
    handleError(
      res,
      error,
      "Get dealer extra bags",
      "Failed to fetch bag pricing",
    );
  }
};

// ------------------------------- Update Dealer Extra Bag --------------------------------

export const updateDealerExtraBag = async (req, res) => {
  try {
    const { id } = req.params;
    const { subCollectionId, price, isActive } = req.body;

    const extraBag = await DealerExtraBag.findById(id);

    if (!extraBag) {
      return res.status(404).json({
        success: false,
        message: "Extra bag not found",
        description: "The requested extra bag pricing entry does not exist.",
      });
    }

    // Update fields
    if (subCollectionId) {
      if (subCollectionId !== extraBag.subCollectionId.toString()) {
        const conflict = await checkExtraBagConflict(subCollectionId, id);
        if (conflict) {
          return res.status(409).json({
            success: false,
            message: "Pricing already exists",
            description:
              "Pricing for this sub-collection has already been set elsewhere.",
          });
        }
      }
      extraBag.subCollectionId = subCollectionId;
    }

    if (price !== undefined) extraBag.price = price;
    if (isActive !== undefined) extraBag.isActive = isActive;
    extraBag.updatedBy = req.user._id;

    await extraBag.save();

    return res.status(200).json({
      success: true,
      message: "Bag pricing updated successfully",
      description: "The extra bag pricing details have been updated.",
      extraBag,
    });
  } catch (error) {
    handleError(
      res,
      error,
      "Update dealer extra bag",
      "Failed to update bag pricing",
    );
  }
};

// ------------------------------- Delete Dealer Extra Bag --------------------------------

export const deleteDealerExtraBag = async (req, res) => {
  try {
    const { id } = req.params;
    const extraBag = await DealerExtraBag.findByIdAndDelete(id);

    if (!extraBag) {
      return res.status(404).json({
        success: false,
        message: "Extra bag not found",
        description: "The requested bag pricing entry does not exist.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bag pricing deleted successfully",
      description: "Pricing for this category has been removed.",
    });
  } catch (error) {
    handleError(
      res,
      error,
      "Delete dealer extra bag",
      "Failed to delete bag pricing",
    );
  }
};

// ------------------------------- Create Dealer Torso Bag --------------------------------

export const createDealerTorsoBag = async (req, res) => {
  try {
    const { bagName, items, baseSize, isActive, stock } = req.body;

    // Validate required fields
    if (!bagName) {
      return res.status(400).json({
        success: false,
        message: "Bag name is required",
        description: "Please provide a name for the torso bag.",
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items are required",
        description: "Please add torso designs to this bag.",
      });
    }

    const base = Number(baseSize);
    if (![100, 500].includes(base)) {
      return res.status(400).json({
        success: false,
        message: "Invalid base size",
        description: "Torso bag base size must be either 100 or 500.",
      });
    }

    const validation = await validateTorsoItems(items, base);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
        description: validation.description,
      });
    }

    // Check for existing bag with same name
    const existing = await checkTorsoBagNameConflict(bagName);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Bag already exists",
        description: `A torso bag named "${bagName}" already exists.`,
      });
    }

    // Process and upload items
    const uploadedItems = await processTorsoBagItems(items);

    const torsoBag = await DealerTorsoBag.create({
      bagName: bagName.trim(),
      items: uploadedItems,
      baseSize: base,
      stock: stock !== undefined ? Math.max(0, Number(stock) || 0) : 0,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Torso bag created successfully",
      description: `The "${torsoBag.bagName}" bag has been created with ${torsoBag.items.length} designs.`,
      torsoBag,
    });
  } catch (error) {
    handleError(
      res,
      error,
      "Create dealer torso bag",
      "Failed to create torso bag",
    );
  }
};

// ------------------------------- Get All Dealer Torso Bags --------------------------------

export const getAllDealerTorsoBags = async (req, res) => {
  try {
    const { page, limit, search } = normalizePagination(req.query);

    const searchQuery = buildSearchQuery(search, ["bagName"]);

    const result = await paginateQuery(DealerTorsoBag, searchQuery, {
      page,
      limit,
      populate: getStandardPopulateOptions(),
    });

    return res.status(200).json(createPaginationResponse(result, "bags"));
  } catch (error) {
    handleError(
      res,
      error,
      "Get dealer torso bags",
      "Failed to fetch torso bags",
    );
  }
};

// ------------------------------- Update Dealer Torso Bag --------------------------------

export const updateDealerTorsoBag = async (req, res) => {
  try {
    const { id } = req.params;
    const { bagName, items, baseSize, isActive, stock } = req.body;

    const torsoBag = await DealerTorsoBag.findById(id);

    if (!torsoBag) {
      return res.status(404).json({
        success: false,
        message: "Torso bag not found",
        description: "The requested torso bag does not exist.",
      });
    }

    // Update fields
    if (bagName) {
      const bagNameTrimmed = bagName.trim();
      if (bagNameTrimmed.toLowerCase() !== torsoBag.bagName.toLowerCase()) {
        const conflict = await checkTorsoBagNameConflict(bagNameTrimmed, id);
        if (conflict) {
          return res.status(409).json({
            success: false,
            message: "Name already taken",
            description: `Another torso bag named "${bagNameTrimmed}" already exists.`,
          });
        }
      }
      torsoBag.bagName = bagNameTrimmed;
    }

    if (isActive !== undefined) torsoBag.isActive = isActive;
    if (stock !== undefined) torsoBag.stock = Math.max(0, Number(stock) || 0);

    if (baseSize !== undefined) {
      const base = Number(baseSize);
      if (![100, 500].includes(base)) {
        return res.status(400).json({
          success: false,
          message: "Invalid base size",
          description: "Torso bag base size must be either 100 or 500.",
        });
      }
      torsoBag.baseSize = base;
    }

    // Process items if provided
    if (items && Array.isArray(items)) {
      const resolvedBase = torsoBag.baseSize;
      const validation = await validateTorsoItems(items, resolvedBase);

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.message,
          description: validation.description,
        });
      }

      const processedItems = await processTorsoBagItemsForUpdate(
        items,
        torsoBag.items,
      );

      torsoBag.items = processedItems;
    }

    torsoBag.updatedBy = req.user._id;
    await torsoBag.save();

    return res.status(200).json({
      success: true,
      message: "Torso bag updated successfully",
      description: `The "${torsoBag.bagName}" bag has been updated.`,
      torsoBag,
    });
  } catch (error) {
    handleError(
      res,
      error,
      "Update dealer torso bag",
      "Failed to update torso bag",
    );
  }
};

// ------------------------------- Delete Dealer Torso Bag --------------------------------

export const deleteDealerTorsoBag = async (req, res) => {
  try {
    const { id } = req.params;
    const torsoBag = await DealerTorsoBag.findById(id);

    if (!torsoBag) {
      return res.status(404).json({
        success: false,
        message: "Torso bag not found",
        description: "The requested torso bag does not exist.",
      });
    }

    // Delete DB record first (instant response for admin)
    await DealerTorsoBag.findByIdAndDelete(id);

    // Clean up images in background (fire-and-forget)
    cleanupItemImages(torsoBag.items);

    return res.status(200).json({
      success: true,
      message: "Torso bag deleted successfully",
      description: "The torso bag and its designs have been removed.",
    });
  } catch (error) {
    handleError(
      res,
      error,
      "Delete dealer torso bag",
      "Failed to delete torso bag",
    );
  }
};

// ------------------------------- Reorder Dealer Torso Bag Items --------------------------------

export const reorderTorsoBagItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemOrder } = req.body;

    if (!itemOrder || !Array.isArray(itemOrder)) {
      return res.status(400).json({
        success: false,
        message: "Invalid item order",
        description: "Please provide an array of item indices.",
      });
    }

    const torsoBag = await DealerTorsoBag.findById(id);

    if (!torsoBag) {
      return res.status(404).json({
        success: false,
        message: "Torso bag not found",
        description: "The requested torso bag does not exist.",
      });
    }

    // Validate that all indices are valid
    if (itemOrder.length !== torsoBag.items.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid item count",
        description: "The number of items in the order must match the bag.",
      });
    }

    // Reorder items based on the provided indices
    const reorderedItems = itemOrder.map((index) => torsoBag.items[index]);

    torsoBag.items = reorderedItems;
    await torsoBag.save();

    return res.status(200).json({
      success: true,
      message: "Items reordered successfully",
      description: "The torso designs have been rearranged.",
      data: torsoBag,
    });
  } catch (error) {
    handleError(
      res,
      error,
      "Reorder torso bag items",
      "Failed to reorder items",
    );
  }
};

// ---------------------------- Dealer Access (Public Endpoints) -----------------------------

export const getDealerBundlesForUser = async (req, res) => {
  try {
    const rawBundles = await Bundle.find({
      bundleType: "dealer",
      isActive: true,
    })
      .select("-createdBy -updatedBy -isActive -__v")
      .sort({ minifigQuantity: 1 })
      .lean();

    const bundles = rawBundles.map((b) => ({
      ...b,
      miscQuantity: getBundleMiscQuantity(b),
    }));

    return res.status(200).json({
      success: true,
      bundles,
    });
  } catch (error) {
    handleError(res, error, "Get user bundles", "Failed to fetch bundles");
  }
};

export const getDealerAddonsForUser = async (req, res) => {
  try {
    const channel = normalizeAddonChannel(req.query.channel);

    const rawAddons = await DealerAddon.find({
      isActive: true,
      ...buildAddonChannelFilter(channel),
    })
      .select("-createdBy -updatedBy -isActive -__v")
      .populate({
        path: "bundleItems.inventoryItemId",
        match: { isActive: true, stock: { $gt: 0 } },
        select:
          "minifigName pricePerBag piecesPerBag stock image colorId category collectionId partType",
        populate: [
          { path: "colorId", select: "colorName hexCode" },
          { path: "collectionId", select: "collectionName" },
        ],
      })
      .sort({ createdAt: 1 })
      .lean();

    // Drop bundle items whose inventory item is inactive or out of stock
    // (populate returns null for non-matches). Also drop bundle-type add-ons
    // that end up with no remaining items.
    const addons = rawAddons
      .map((addon) => ({
        ...addon,
        bundleItems: (addon.bundleItems || []).filter(
          (item) => item.inventoryItemId !== null,
        ),
      }))
      .filter((addon) => {
        // Bundle add-ons need at least one in-stock item to be orderable.
        if (addon.addonType === "bundle") {
          return (addon.bundleItems?.length || 0) > 0;
        }
        // Upgrade add-ons with finite stock disappear once sold out.
        if (
          addon.stock !== null &&
          addon.stock !== undefined &&
          addon.stock <= 0
        ) {
          return false;
        }
        return true;
      });

    return res.status(200).json({
      success: true,
      addons,
    });
  } catch (error) {
    handleError(res, error, "Get user addons", "Failed to fetch addons");
  }
};

export const getDealerExtraBagsForUser = async (req, res) => {
  try {
    const extraBags = await DealerExtraBag.find({ isActive: true })
      .populate("subCollectionId", "subCollectionName")
      .select("-createdBy -updatedBy -isActive -__v")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      extraBags,
    });
  } catch (error) {
    handleError(
      res,
      error,
      "Get user extra bags",
      "Failed to fetch extra bags",
    );
  }
};

export const getDealerTorsoBagsForUser = async (req, res) => {
  try {
    const query = { isActive: true, stock: { $gt: 0 } };

    // Filter by base size when provided
    if (req.query.baseSize) {
      query.baseSize = Number(req.query.baseSize);
    }

    const torsoBags = await DealerTorsoBag.find(query)
      .select("-createdBy -updatedBy -isActive -__v")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      torsoBags,
    });
  } catch (error) {
    handleError(
      res,
      error,
      "Get user torso bags",
      "Failed to fetch torso bags",
    );
  }
};
