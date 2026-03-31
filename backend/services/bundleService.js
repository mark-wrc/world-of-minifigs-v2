import Bundle from "../models/bundle.model.js";
import DealerTorsoBag from "../models/dealerTorsoBag.model.js";
import {
  processItemsForCreate,
  processItemsForUpdate,
} from "./imageService.js";

// ------------------------ Constants ------------------------------------

const TORSO_FOLDER = "world-of-minifigs-v2/dealers/torsos";
const ADDON_FOLDER = "world-of-minifigs-v2/dealers/addons";

// ------------------------ Quantity Helpers ------------------------------------

export const getMiscQuantity = (bundleSize) => {
  if (bundleSize === 1000) return 80;
  if (bundleSize === 500) return 40;
  return 10;
};

export const getAdminTarget = (targetBundleSize) =>
  targetBundleSize - getMiscQuantity(targetBundleSize);

export const getBaseBundleSize = async (bundleType = "dealer") => {
  const lowestBundle = await Bundle.findOne({
    bundleType,
    isActive: true,
  }).sort({ minifigQuantity: 1 });
  return lowestBundle ? lowestBundle.minifigQuantity : 100;
};

// ------------------------ Torso Item Validation ------------------------------------

export const validateTorsoItems = async (items, targetBundleSize) => {
  const adminTarget = getAdminTarget(targetBundleSize);
  const totalQty = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );

  if (totalQty !== adminTarget) {
    return {
      isValid: false,
      message: "Invalid total quantity",
      description: `Total designs quantity must equal ${adminTarget} (${targetBundleSize} minus ${getMiscQuantity(targetBundleSize)} miscellaneous). Current total: ${totalQty}.`,
    };
  }

  return { isValid: true };
};

// ------------------------ Conflict Checks ------------------------------------

export const checkTorsoBagNameConflict = async (bagName, excludeId = null) => {
  const query = {
    bagName: { $regex: new RegExp(`^${bagName.trim()}$`, "i") },
  };
  if (excludeId) query._id = { $ne: excludeId };
  return DealerTorsoBag.findOne(query);
};

// ------------------------ Torso Bag Item Processing (Create) ------------------------------

export const processTorsoBagItems = async (items, folderPath = TORSO_FOLDER) =>
  processItemsForCreate(items, folderPath, {
    getImage: (item) => item.image,
    transform: (item, uploadedImage) => ({
      image: uploadedImage,
      quantity: Number(item.quantity),
    }),
  });

// ------------------------ Torso Bag Item Processing (Update) ------------------------------

export const processTorsoBagItemsForUpdate = async (
  items,
  existingItems,
  folderPath = TORSO_FOLDER,
) =>
  processItemsForUpdate(items, existingItems, folderPath, {
    isExisting: (item) =>
      typeof item === "object" && item.image && item.image.publicId,
    getImage: (item) => {
      if (typeof item.image === "string") return item.image;
      return item.image?.url && !item.image.url.startsWith("http")
        ? item.image.url
        : null;
    },
    transform: (item, uploadedImage) => ({
      image: uploadedImage,
      quantity: Number(item.quantity),
    }),
  });

// ------------------------ Addon Item Processing (Create) --------------------------------

export const processAddonItems = async (items, folderPath = ADDON_FOLDER) =>
  processItemsForCreate(items, folderPath, {
    getImage: (item) => {
      const isObject = typeof item === "object";
      return isObject ? item.image : item;
    },
    transform: (item, uploadedImage) => {
      const isObject = typeof item === "object";
      return {
        itemName: isObject ? item.itemName : undefined,
        itemPrice: isObject ? item.itemPrice : undefined,
        color: isObject ? item.color : undefined,
        image: uploadedImage,
      };
    },
  });

// ------------------------ Addon Item Processing (Update) --------------------------------

export const processAddonItemsForUpdate = async (
  items,
  existingItems,
  folderPath = ADDON_FOLDER,
) =>
  processItemsForUpdate(items, existingItems, folderPath, {
    isExisting: (item) =>
      typeof item === "object" && item.image && item.image.publicId,
    getImage: (item) => {
      const isObject = typeof item === "object";
      return isObject ? item.image : item;
    },
    transform: (item, uploadedImage) => {
      const isObject = typeof item === "object";
      return {
        itemName: isObject ? item.itemName : undefined,
        itemPrice: isObject ? item.itemPrice : undefined,
        color: isObject ? item.color : undefined,
        image: uploadedImage,
      };
    },
  });
