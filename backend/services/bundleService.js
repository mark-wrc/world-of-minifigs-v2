import DealerTorsoBag from "../models/dealerTorsoBag.model.js";
import GeneralInventory from "../models/generalInventory.model.js";
import { TORSO_PART_TYPES } from "../../shared/inventoryData.js";
import { processItemsForCreate, processItemsForUpdate } from "./imageService.js";

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
// Torso bag items reference torsos in General Inventory (bulk-minifig-parts)
// instead of embedding their own image copies. Each incoming item is
// { inventoryItemId, quantity }; the server validates the reference and persists
// only the id + quantity. The torso's image/name/color live on the inventory
// item and are populated on read — so a torso reused across bags is stored once
// in Cloudinary, never duplicated.

// Validate incoming torso items against General Inventory and normalize them to
// their stored shape { inventoryItemId, quantity }. Returns { isValid, items? }
// or { isValid: false, error } for the controller to forward.
export const validateTorsoInventoryItems = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: "Items are required",
        description: "Please add at least one torso to this bag.",
      },
    };
  }

  const ids = items.map((item) => item?.inventoryItemId);

  if (ids.some((id) => !id)) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: "Invalid torso item",
        description: "Each torso must reference an inventory item.",
      },
    };
  }

  if (new Set(ids.map(String)).size !== ids.length) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: "Duplicate torso found",
        description: "Each torso can only appear once in a bag.",
      },
    };
  }

  const stored = [];
  for (const item of items) {
    const inventoryItem = await GeneralInventory.findById(
      item.inventoryItemId,
    ).lean();

    if (!inventoryItem) {
      return {
        isValid: false,
        error: {
          status: 404,
          message: "Torso not found",
          description: `The inventory item "${item.inventoryItemId}" does not exist.`,
        },
      };
    }

    if (!TORSO_PART_TYPES.includes(inventoryItem.partType)) {
      return {
        isValid: false,
        error: {
          status: 400,
          message: "Not a torso",
          description: `"${inventoryItem.minifigName}" is not a torso part type and cannot be added to a torso bag.`,
        },
      };
    }

    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0));
    stored.push({ inventoryItemId: inventoryItem._id, quantity });
  }

  return { isValid: true, items: stored };
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
