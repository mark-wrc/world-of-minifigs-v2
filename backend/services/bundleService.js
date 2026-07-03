import DealerTorsoBag from "../models/dealerTorsoBag.model.js";
import {
  processItemsForCreate,
  processItemsForUpdate,
  deleteMultipleImages,
} from "./imageService.js";

// ------------------------ Constants ------------------------------------

// Torso images now upload directly to Cloudinary from the browser; their folder
// is owned by backend/controllers/uploadController.js (UPLOAD_FOLDERS).
const ADDON_FOLDER = "world-of-minifigs-v2/dealers/addons";

// Miscellaneous ("mystery") torsos per single base bag.
// 10 misc per 100-bag, 40 misc per 500-bag. Multiplied for multi-bag bundles.
export const MISC_PER_BAG = { 100: 10, 500: 40 };

// ------------------------ Quantity Helpers ------------------------------------

export const getMiscPerBag = (baseSize) => MISC_PER_BAG[baseSize] ?? 0;

// Total misc for a bundle = misc-per-bag × (multiplier).
export const getBundleMiscQuantity = (bundle) => {
  if (!bundle?.baseSize) return 0;
  const multiplier = bundle.minifigQuantity / bundle.baseSize;
  return getMiscPerBag(bundle.baseSize) * multiplier;
};

// Admin-configurable designs per base bag (e.g. 90 for size-100, 460 for size-500).
export const getAdminTarget = (baseSize) => baseSize - getMiscPerBag(baseSize);

// ------------------------ Torso Item Validation ------------------------------------

export const validateTorsoItems = async (items, baseSize) => {
  const adminTarget = getAdminTarget(baseSize);
  const totalQty = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );

  if (totalQty !== adminTarget) {
    return {
      isValid: false,
      message: "Invalid total quantity",
      description: `Total designs quantity must equal ${adminTarget} (${baseSize} minus ${getMiscPerBag(baseSize)} miscellaneous). Current total: ${totalQty}.`,
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

// ------------------------ Torso Bag Item Processing ------------------------------
//
// Torso images are uploaded straight from the browser to Cloudinary (see
// uploadController + frontend cloudinaryUpload), so every item arrives already
// referencing a stored image: { image: { publicId, url }, quantity }. The
// server never receives or parses image bytes — it only validates and persists
// the references, which is what keeps the request body tiny.

// Normalize + validate a single incoming item into its stored shape.
const toStoredTorsoItem = (item) => {
  const publicId = item?.image?.publicId;
  const url = item?.image?.url;

  if (!publicId || !url) {
    throw new Error(
      "Each torso design must reference an uploaded image (publicId and url).",
    );
  }

  return {
    image: { publicId, url },
    quantity: Number(item.quantity),
  };
};

// Create: persist the uploaded references as-is.
export const processTorsoBagItems = (items) => items.map(toStoredTorsoItem);

// Update: persist the new references, and clean up any previously-stored
// Cloudinary images the admin dropped from the bag.
export const processTorsoBagItemsForUpdate = (items, existingItems) => {
  const stored = items.map(toStoredTorsoItem);

  const keptIds = new Set(stored.map((item) => item.image.publicId));
  const removedIds = (existingItems || [])
    .map((item) => item.image?.publicId)
    .filter((id) => id && !keptIds.has(id));

  deleteMultipleImages(removedIds);

  return stored;
};

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
