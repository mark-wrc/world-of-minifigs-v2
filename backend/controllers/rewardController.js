import Bundle from "../models/bundle.model.js";
import RewardAddon from "../models/rewardAddon.model.js";
import {
  normalizePagination,
  buildSearchQuery,
  paginateQuery,
  createPaginationResponse,
} from "../utils/pagination.js";
import { handleError } from "../utils/commonUtils.js";
import { validateAndReturnFeatures } from "../utils/bundleUtils.js";
import { AUDIT_POPULATE } from "../utils/populateHelpers.js";
import {
  checkBundleQuantityConflict,
  findBundleByIdAndType,
} from "../utils/bundleUtils.js";

// ==================== Helper Functions ====================

const validateQuantity = (quantity, fieldName = "Quantity") => {
  if (!quantity || quantity < 1) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: `${fieldName} is required`,
        description: `Please provide a valid ${fieldName.toLowerCase()} (at least 1).`,
      },
    };
  }
  return { isValid: true };
};

const validateDuration = (duration) => {
  if (duration !== undefined && duration < 1) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: "Invalid duration",
        description: "Duration must be at least 1 month.",
      },
    };
  }
  return { isValid: true };
};

const createNotFoundResponse = (itemType) => ({
  status: 404,
  body: {
    success: false,
    message: `${itemType} not found`,
    description: `The requested reward ${itemType.toLowerCase()} does not exist.`,
  },
});

const createConflictResponse = (message, description) => ({
  status: 409,
  body: {
    success: false,
    message,
    description,
  },
});

const findRewardBundleById = async (id) => findBundleByIdAndType("reward", id);

const findRewardAddonById = async (id) => {
  return await RewardAddon.findById(id);
};

const checkBundleConflict = async (minifigQuantity, excludeId = null) =>
  checkBundleQuantityConflict("reward", minifigQuantity, excludeId);

const checkAddonConflict = async (quantity, duration, excludeId = null) => {
  const query = {
    quantity,
    duration: duration || 3,
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return await RewardAddon.findOne(query);
};

const getStandardPopulateOptions = () => AUDIT_POPULATE;

// ==================== Create Reward Bundle ====================

export const createRewardBundle = async (req, res) => {
  try {
    const { bundleName, minifigQuantity, totalPrice, features, isActive } =
      req.body;

    // Validate features
    const featuresResult = validateAndReturnFeatures(features);
    if (featuresResult.error) {
      return res.status(featuresResult.error.status).json(featuresResult.error);
    }

    // Validate required fields
    if (!bundleName) {
      return res.status(400).json({
        success: false,
        message: "Bundle name is required",
        description: "Please provide a name for the bundle.",
      });
    }

    const quantityValidation = validateQuantity(
      minifigQuantity,
      "Valid quantity",
    );
    if (!quantityValidation.isValid) {
      return res
        .status(quantityValidation.error.status)
        .json(quantityValidation.error);
    }

    // Check for existing bundle with same quantity
    const existingBundle = await checkBundleConflict(minifigQuantity);
    if (existingBundle) {
      const conflict = createConflictResponse(
        "Bundle already exists",
        `A reward bundle with ${minifigQuantity} minifigs already exists.`,
      );
      return res.status(conflict.status).json(conflict.body);
    }

    // Prepare bundle data
    const bundleData = {
      bundleName: bundleName.trim(),
      bundleType: "reward",
      minifigQuantity,
      totalPrice,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
    };

    if (featuresResult.features) {
      bundleData.features = featuresResult.features;
    }

    const bundle = await Bundle.create(bundleData);

    return res.status(201).json({
      success: true,
      message: "Reward bundle created successfully",
      description: `The "${bundle.bundleName}" reward bundle has been added.`,
      bundle,
    });
  } catch (error) {
    handleError(res, error, "Create reward bundle", "Failed to create bundle");
  }
};

// ==================== Get All Reward Bundles ====================

export const getAllRewardBundles = async (req, res) => {
  try {
    const { page, limit, search } = normalizePagination(req.query);

    const searchQuery = {
      bundleType: "reward",
      ...buildSearchQuery(search, ["bundleName"]),
    };

    const result = await paginateQuery(Bundle, searchQuery, {
      page,
      limit,
      populate: getStandardPopulateOptions(),
    });

    return res.status(200).json(createPaginationResponse(result, "bundles"));
  } catch (error) {
    handleError(res, error, "Get reward bundles", "Failed to fetch bundles");
  }
};

// ==================== Update Reward Bundle ====================

export const updateRewardBundle = async (req, res) => {
  try {
    const { id } = req.params;
    const { bundleName, minifigQuantity, totalPrice, features, isActive } =
      req.body;

    // Validate features
    const featuresResult = validateAndReturnFeatures(features);
    if (featuresResult.error) {
      return res.status(featuresResult.error.status).json(featuresResult.error);
    }

    // Find bundle
    const bundle = await findRewardBundleById(id);
    if (!bundle) {
      const notFound = createNotFoundResponse("Bundle");
      return res.status(notFound.status).json(notFound.body);
    }

    // Update fields
    if (bundleName) bundle.bundleName = bundleName.trim();

    if (minifigQuantity !== undefined) {
      if (minifigQuantity !== bundle.minifigQuantity) {
        const conflict = await checkBundleConflict(minifigQuantity, id);
        if (conflict) {
          const conflictResponse = createConflictResponse(
            "Quantity conflict",
            `Another reward bundle with ${minifigQuantity} minifigs already exists.`,
          );
          return res
            .status(conflictResponse.status)
            .json(conflictResponse.body);
        }
      }
      bundle.minifigQuantity = minifigQuantity;
    }

    if (totalPrice !== undefined) bundle.totalPrice = totalPrice;

    if (features !== undefined && featuresResult.features !== undefined) {
      bundle.features = featuresResult.features;
    }

    if (isActive !== undefined) bundle.isActive = isActive;

    bundle.updatedBy = req.user._id;
    await bundle.save();

    return res.status(200).json({
      success: true,
      message: "Reward bundle updated successfully",
      description: `The "${bundle.bundleName}" bundle has been successfully updated.`,
      bundle,
    });
  } catch (error) {
    handleError(res, error, "Update reward bundle", "Failed to update bundle");
  }
};

// ==================== Delete Reward Bundle ====================

export const deleteRewardBundle = async (req, res) => {
  try {
    const { id } = req.params;
    const bundle = await Bundle.findOneAndDelete({
      _id: id,
      bundleType: "reward",
    });

    if (!bundle) {
      const notFound = createNotFoundResponse("Bundle");
      return res.status(notFound.status).json(notFound.body);
    }

    return res.status(200).json({
      success: true,
      message: "Reward bundle deleted successfully",
      description: `The bundle has been removed from reward options.`,
    });
  } catch (error) {
    handleError(res, error, "Delete reward bundle", "Failed to delete bundle");
  }
};

// ==================== Create Reward Addon ====================

export const createRewardAddon = async (req, res) => {
  try {
    const { price, quantity, duration, features, isActive } = req.body;

    // Validate features
    const featuresResult = validateAndReturnFeatures(features);
    if (featuresResult.error) {
      return res.status(featuresResult.error.status).json(featuresResult.error);
    }

    // Validate required fields
    const quantityValidation = validateQuantity(quantity);
    if (!quantityValidation.isValid) {
      return res
        .status(quantityValidation.error.status)
        .json(quantityValidation.error);
    }

    const finalDuration = duration || 3;

    // Check for existing addon with same combination
    const existingAddon = await checkAddonConflict(quantity, finalDuration);
    if (existingAddon) {
      const conflict = createConflictResponse(
        "Add-on already exists",
        `An add-on with ${quantity} minifigs/month for ${finalDuration} months already exists.`,
      );
      return res.status(conflict.status).json(conflict.body);
    }

    // Prepare addon data
    const addonData = {
      price,
      quantity,
      duration: finalDuration,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
    };

    if (featuresResult.features) {
      addonData.features = featuresResult.features;
    }

    const addon = await RewardAddon.create(addonData);

    return res.status(201).json({
      success: true,
      message: "Reward add-on created successfully",
      description: `The add-on (${addon.quantity} minifigs/month for ${addon.duration} months) is now available for rewards.`,
      addon,
    });
  } catch (error) {
    handleError(res, error, "Create reward addon", "Failed to create add-on");
  }
};

// ==================== Get All Reward Addons ====================

export const getAllRewardAddons = async (req, res) => {
  try {
    const { page, limit, search } = normalizePagination(req.query);

    // Search across features (string array)
    const searchQuery = buildSearchQuery(search, ["features"]);

    const result = await paginateQuery(RewardAddon, searchQuery, {
      page,
      limit,
      populate: getStandardPopulateOptions(),
    });

    return res.status(200).json(createPaginationResponse(result, "addons"));
  } catch (error) {
    handleError(res, error, "Get reward addons", "Failed to fetch add-ons");
  }
};

// ==================== Update Reward Addon ====================

export const updateRewardAddon = async (req, res) => {
  try {
    const { id } = req.params;
    const { price, quantity, duration, features, isActive } = req.body;

    // Validate features
    const featuresResult = validateAndReturnFeatures(features);
    if (featuresResult.error) {
      return res.status(featuresResult.error.status).json(featuresResult.error);
    }

    // Find addon
    const addon = await findRewardAddonById(id);
    if (!addon) {
      const notFound = createNotFoundResponse("Add-on");
      return res.status(notFound.status).json(notFound.body);
    }

    // Check for conflicts if quantity or duration is being changed
    const newQuantity = quantity !== undefined ? quantity : addon.quantity;
    const newDuration = duration !== undefined ? duration : addon.duration;

    if (
      (quantity !== undefined && quantity !== addon.quantity) ||
      (duration !== undefined && duration !== addon.duration)
    ) {
      const conflict = await checkAddonConflict(newQuantity, newDuration, id);
      if (conflict) {
        const conflictResponse = createConflictResponse(
          "Add-on already exists",
          `An add-on with ${newQuantity} minifigs/month for ${newDuration} months already exists.`,
        );
        return res.status(conflictResponse.status).json(conflictResponse.body);
      }
    }

    // Update fields
    if (price !== undefined) addon.price = price;

    if (quantity !== undefined) {
      const quantityValidation = validateQuantity(quantity);
      if (!quantityValidation.isValid) {
        return res
          .status(quantityValidation.error.status)
          .json(quantityValidation.error);
      }
      addon.quantity = quantity;
    }

    if (duration !== undefined) {
      const durationValidation = validateDuration(duration);
      if (!durationValidation.isValid) {
        return res
          .status(durationValidation.error.status)
          .json(durationValidation.error);
      }
      addon.duration = duration;
    }

    if (features !== undefined && featuresResult.features !== undefined) {
      addon.features = featuresResult.features;
    }

    if (isActive !== undefined) addon.isActive = isActive;

    addon.updatedBy = req.user._id;
    await addon.save();

    return res.status(200).json({
      success: true,
      message: "Reward add-on updated successfully",
      description: `The add-on (${addon.quantity} minifigs/month for ${addon.duration} months) has been updated.`,
      addon,
    });
  } catch (error) {
    handleError(res, error, "Update reward addon", "Failed to update add-on");
  }
};

// ==================== Delete Reward Addon ====================

export const deleteRewardAddon = async (req, res) => {
  try {
    const { id } = req.params;
    const addon = await findRewardAddonById(id);

    if (!addon) {
      const notFound = createNotFoundResponse("Add-on");
      return res.status(notFound.status).json(notFound.body);
    }

    await RewardAddon.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Reward add-on deleted successfully",
      description: "The add-on has been removed from reward options.",
    });
  } catch (error) {
    handleError(res, error, "Delete reward addon", "Failed to delete add-on");
  }
};

// ==================== Public Access (Public Endpoints) ====================

export const getRewardBundlesForUser = async (req, res) => {
  try {
    const bundles = await Bundle.find({
      bundleType: "reward",
      isActive: true,
    })
      .select("-createdBy -updatedBy -isActive -__v")
      .sort({ minifigQuantity: 1 });

    return res.status(200).json({
      success: true,
      bundles,
    });
  } catch (error) {
    handleError(res, error, "Get reward bundles", "Failed to fetch bundles");
  }
};

export const getRewardAddonsForUser = async (req, res) => {
  try {
    const addons = await RewardAddon.find({ isActive: true })
      .select("-createdBy -updatedBy -isActive -__v")
      .sort({ duration: 1, quantity: 1 });

    return res.status(200).json({
      success: true,
      addons,
    });
  } catch (error) {
    handleError(res, error, "Get reward addons", "Failed to fetch addons");
  }
};
