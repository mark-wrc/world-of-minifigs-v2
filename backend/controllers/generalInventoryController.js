import GeneralInventory, {
  INVENTORY_CATEGORIES,
  BULK_MINIFIG_PART_TYPES,
} from "../models/generalInventory.model.js";
import Collection from "../models/collection.model.js";
import Color from "../models/color.model.js";
import DealerAddon from "../models/dealerAddon.model.js";
import DealerTorsoBag from "../models/dealerTorsoBag.model.js";
import Order from "../models/order.model.js";
import { ORDER_STATUSES } from "../constants/orderConstants.js";
import {
  normalizeImageRef,
  deleteSingleImage,
} from "../services/imageService.js";
import {
  normalizePagination,
  buildSearchQuery,
  paginateQuery,
  createPaginationResponse,
} from "../utils/pagination.js";
import { normalizeItemBadge } from "../../shared/itemBadges.js";
import { checkNameConflict } from "../utils/commonUtils.js";
import { AUDIT_POPULATE } from "../utils/populateHelpers.js";
import {
  getActiveFlashSaleMap,
  getFlashSaleForItem,
} from "../utils/flashSale/resolver.js";

// Image uploads go browser→Cloudinary directly; folder owned by uploadController.js.

// Order statuses that count as a completed sale (excludes cancelled/failed).
const SOLD_ORDER_STATUSES = [ORDER_STATUSES.PAID, ORDER_STATUSES.SHIPPED];

// Consumers that still reference an inventory item. Deleting an item removes its
// image and dangles these references, so deletion is blocked for BOTH. Add-ons
// also drop an item the moment it's inactive, so deactivation is blocked for
// add-ons — but a torso bag shows its torsos regardless of the torso's own
// active/stock status (a bag is a curated set), so deactivation is NOT blocked
// by torso bags.
const findAddonsUsingInventoryItem = (id) =>
  DealerAddon.find({ "bundleItems.inventoryItemId": id }, "addonName").lean();

const findTorsoBagsUsingInventoryItem = (id) =>
  DealerTorsoBag.find({ "items.inventoryItemId": id }, "bagName").lean();

// Build a 409 "in use" response body from whichever consumers are passed
// (empty/omitted arrays are skipped), else null. Keeps the wording in one place.
const inUseConflict = ({ addons = [], torsoBags = [] }) => {
  if (addons.length > 0) {
    const names = addons.map((a) => `"${a.addonName}"`).join(", ");
    return {
      success: false,
      message: "Inventory item is in use",
      description: `This item is used in the following dealer add-on(s): ${names}. Remove it from those add-ons first.`,
    };
  }
  if (torsoBags.length > 0) {
    const names = torsoBags.map((b) => `"${b.bagName}"`).join(", ");
    return {
      success: false,
      message: "Inventory item is in use",
      description: `This item is used in the following dealer torso bag(s): ${names}. Remove it from those bags first.`,
    };
  }
  return null;
};

// Sum the bags sold per inventory item from dealer/wholesale order add-ons.
// Returns a Map keyed by inventory id (string) -> total bags sold.
const getSoldBagsMap = async (inventoryIds) => {
  if (!inventoryIds?.length) return new Map();

  const sales = await Order.aggregate([
    { $match: { status: { $in: SOLD_ORDER_STATUSES } } },
    { $unwind: "$dealerItems.addons" },
    { $unwind: "$dealerItems.addons.subItems" },
    { $match: { "dealerItems.addons.subItems.invId": { $in: inventoryIds } } },
    {
      $group: {
        _id: "$dealerItems.addons.subItems.invId",
        soldBags: { $sum: "$dealerItems.addons.subItems.qty" },
      },
    },
  ]);

  return new Map(sales.map((s) => [String(s._id), s.soldBags]));
};

//------------------------------------------------ Create General Inventory (Bulk) ------------------------------------------
export const createGeneralInventoryBulk = async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No items provided",
      description: "Please provide an array of inventory items to upload.",
    });
  }

  const results = {
    saved: [],
    failed: [],
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rowId = item.rowId || i;

    try {
      const {
        minifigName,
        itemId,
        pricePerBag,
        piecesPerBag,
        stock,
        colorId,
        image,
        isActive,
        badge,
        category,
        collectionIds,
        collectionId,
        partType,
      } = item;

      // Normalize to an array of unique collection ids (accepts either the new
      // `collectionIds` array or a legacy single `collectionId`).
      const collectionIdList = [
        ...new Set(
          (Array.isArray(collectionIds)
            ? collectionIds
            : collectionId
              ? [collectionId]
              : []
          )
            .map((c) => (c ? String(c) : null))
            .filter(Boolean),
        ),
      ];

      // Validate required fields
      if (!minifigName || !String(minifigName).trim())
        throw new Error("Minifig name is required");
      if (!pricePerBag || Number(pricePerBag) <= 0)
        throw new Error("Price per bag must be greater than zero");
      if (
        piecesPerBag !== undefined &&
        piecesPerBag !== null &&
        (!Number.isInteger(Number(piecesPerBag)) || Number(piecesPerBag) < 1)
      ) {
        throw new Error("Pieces per bag must be a positive integer");
      }
      if (
        stock === undefined ||
        stock === null ||
        !Number.isInteger(Number(stock)) ||
        Number(stock) < 0
      ) {
        throw new Error("Stock (bags) must be a non-negative integer");
      }
      if (!colorId) throw new Error("Color is required");
      if (!image) throw new Error("Image is required");
      if (category && !INVENTORY_CATEGORIES.includes(category))
        throw new Error(
          `Category must be one of: ${INVENTORY_CATEGORIES.join(", ")}`,
        );

      if (category === "minifigs" && collectionIdList.length === 0)
        throw new Error(
          "At least one collection is required for minifig items",
        );

      if (category === "bulk-minifig-parts") {
        if (!partType)
          throw new Error("Part type is required for bulk minifig parts");
        if (!BULK_MINIFIG_PART_TYPES.includes(partType))
          throw new Error(
            `Part type must be one of: ${BULK_MINIFIG_PART_TYPES.join(", ")}`,
          );
      }

      // Verify color exists
      const color = await Color.findById(colorId);
      if (!color) throw new Error("Selected color does not exist");

      // Verify every provided collection exists
      if (collectionIdList.length > 0) {
        const found = await Collection.countDocuments({
          _id: { $in: collectionIdList },
        });
        if (found !== collectionIdList.length)
          throw new Error("One or more selected collections do not exist");
      }

      // Check for duplicate name + color combo (Non-blocking warning for bulk)
      const existing = await checkNameConflict(
        GeneralInventory,
        "minifigName",
        String(minifigName).trim(),
        null,
        { colorId },
      );
      const warning = existing
        ? `Item with name "${minifigName}" and color "${color.colorName}" already exists.`
        : null;

      // Image was uploaded directly to Cloudinary by the browser; store its ref.
      const uploadedImage = normalizeImageRef(image);

      const newInventory = await GeneralInventory.create({
        minifigName: String(minifigName).trim(),
        itemId: itemId ? String(itemId).trim() : null,
        pricePerBag: Number(pricePerBag),
        piecesPerBag:
          piecesPerBag !== undefined && piecesPerBag !== null
            ? Number(piecesPerBag)
            : 1,
        stock: Number(stock),
        colorId,
        category,
        collectionIds: category === "minifigs" ? collectionIdList : [],
        partType: category === "bulk-minifig-parts" ? partType : null,
        // Honor the visibility toggle on create; default to active when omitted.
        isActive: isActive === undefined ? true : Boolean(isActive),
        // Badge is opt-in; anything unrecognised (or omitted) means "no badge".
        badge: normalizeItemBadge(badge),
        image: uploadedImage,
        createdBy: req.user._id,
      });

      results.saved.push({
        rowId,
        id: newInventory._id,
        minifigName: newInventory.minifigName,
        warning,
      });
    } catch (error) {
      results.failed.push({
        rowId,
        name: item.minifigName || item.name || `Row ${i + 1}`,
        reason: error.message,
      });
    }
  }

  const totalSaved = results.saved.length;
  const totalFailed = results.failed.length;

  return res.status(200).json({
    success: true,
    message: `Inventory completed: ${totalSaved} saved, ${totalFailed} failed.`,
    summary: {
      totalSaved,
      totalFailed,
    },
    results,
  });
};

//------------------------------------------------ Get All General Inventory ------------------------------------------
export const getAllGeneralInventory = async (req, res) => {
  try {
    const { page, limit, search } = normalizePagination(req.query);
    const { category, stock, status, partType, partTypes, collectionId, sort } =
      req.query;

    const baseFilter = {};

    if (category && INVENTORY_CATEGORIES.includes(category)) {
      baseFilter.category = category;
    }

    if (partType && BULK_MINIFIG_PART_TYPES.includes(partType)) {
      baseFilter.partType = partType;
    } else if (partTypes) {
      // Comma-separated list — filter to any of the given valid part types.
      const requested = String(partTypes)
        .split(",")
        .map((p) => p.trim())
        .filter((p) => BULK_MINIFIG_PART_TYPES.includes(p));
      if (requested.length > 0) {
        baseFilter.partType = { $in: requested };
      }
    }

    if (collectionId) {
      // Array field: matches any item that includes this collection.
      baseFilter.collectionIds = collectionId;
    }

    // Stock tier filter — matches the StockCell color tiers used in the UI.
    if (stock === "out") {
      baseFilter.stock = { $lte: 0 };
    } else if (stock === "low") {
      baseFilter.stock = { $gt: 0, $lt: 50 };
    } else if (stock === "in") {
      baseFilter.stock = { $gte: 50 };
    }

    if (status === "active") {
      baseFilter.isActive = true;
    } else if (status === "inactive") {
      baseFilter.isActive = false;
    }

    let searchQuery = { ...baseFilter };

    if (search) {
      const nameQuery = buildSearchQuery(search, ["minifigName", "itemId"]);

      // Also search by color name
      const matchingColors = await Color.find(
        buildSearchQuery(search, ["colorName"]),
      )
        .select("_id")
        .lean();

      const matchingColorIds = matchingColors.map((c) => c._id);

      let textConditions = [];
      if (Object.keys(nameQuery).length > 0) textConditions.push(nameQuery);
      if (matchingColorIds.length > 0)
        textConditions.push({ colorId: { $in: matchingColorIds } });

      if (textConditions.length > 0) {
        searchQuery = {
          ...baseFilter,
          $or: textConditions,
        };
      }
    }

    const populate = [
      { path: "colorId", select: "colorName hexCode" },
      { path: "collectionIds", select: "collectionName" },
      ...AUDIT_POPULATE,
    ];

    // Sales sort needs the bags-sold total ranked across the WHOLE filtered set
    // before paginating, since `soldBags` is derived from orders (not a stored
    // field) and can't be sorted by the DB query directly.
    if (sort === "sales-high" || sort === "sales-low") {
      const allItems = await GeneralInventory.find(searchQuery)
        .select("_id createdAt")
        .lean();

      const soldMap = await getSoldBagsMap(allItems.map((item) => item._id));

      const dir = sort === "sales-high" ? -1 : 1;
      allItems.sort((a, b) => {
        const sa = soldMap.get(String(a._id)) || 0;
        const sb = soldMap.get(String(b._id)) || 0;
        if (sa !== sb) return (sa - sb) * dir;
        // Tie-breaker: newest first, matching the default listing order.
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      const totalItems = allItems.length;
      const totalPages = Math.ceil(totalItems / limit);
      const skip = (page - 1) * limit;
      const pageIds = allItems.slice(skip, skip + limit).map((i) => i._id);

      const docs = await GeneralInventory.find({ _id: { $in: pageIds } })
        .select("-__v")
        .populate(populate)
        .lean();

      const docMap = new Map(docs.map((d) => [String(d._id), d]));
      const saleMap = await getActiveFlashSaleMap(pageIds);
      const data = pageIds
        .map((id) => docMap.get(String(id)))
        .filter(Boolean)
        .map((item) => ({
          ...item,
          soldBags: soldMap.get(String(item._id)) || 0,
          flashSale: getFlashSaleForItem(item, saleMap),
        }));

      return res.status(200).json(
        createPaginationResponse(
          {
            data,
            pagination: {
              page,
              limit,
              totalItems,
              totalPages,
              hasNextPage: page < totalPages,
              hasPreviousPage: page > 1,
            },
          },
          "inventory",
        ),
      );
    }

    const result = await paginateQuery(GeneralInventory, searchQuery, {
      page,
      limit,
      sort: { createdAt: -1 },
      populate,
    });

    // Attach bags-sold (from orders) + active flash-sale pricing to each item
    // on the current page.
    const soldMap = await getSoldBagsMap(result.data.map((item) => item._id));
    const saleMap = await getActiveFlashSaleMap(
      result.data.map((item) => item._id),
    );
    result.data = result.data.map((item) => ({
      ...item,
      soldBags: soldMap.get(String(item._id)) || 0,
      flashSale: getFlashSaleForItem(item, saleMap),
    }));

    return res.status(200).json(createPaginationResponse(result, "inventory"));
  } catch (error) {
    console.error("Get all inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get Single General Inventory ------------------------------------------
export const getGeneralInventoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const inventory = await GeneralInventory.findById(id)
      .populate("colorId", "colorName hexCode")
      .populate("collectionIds", "collectionName")
      .populate("createdBy", "firstName lastName username")
      .populate("updatedBy", "firstName lastName username")
      .lean();

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
        description: "The requested inventory item does not exist.",
      });
    }

    return res.status(200).json({
      success: true,
      inventory,
    });
  } catch (error) {
    console.error("Get inventory by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory item",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Update General Inventory ------------------------------------------
export const updateGeneralInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      minifigName,
      itemId,
      pricePerBag,
      piecesPerBag,
      cost,
      bin,
      stock,
      colorId,
      image,
      isActive,
      badge,
      category,
      collectionIds,
      collectionId, // legacy single-value support
      partType,
    } = req.body;

    // Normalize incoming collections (array or legacy single) when provided.
    const hasCollectionUpdate =
      collectionIds !== undefined || collectionId !== undefined;
    const collectionIdList = hasCollectionUpdate
      ? [
          ...new Set(
            (Array.isArray(collectionIds)
              ? collectionIds
              : collectionId
                ? [collectionId]
                : []
            )
              .map((c) => (c ? String(c) : null))
              .filter(Boolean),
          ),
        ]
      : null;

    const inventory = await GeneralInventory.findById(id);

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
        description: "The requested inventory item does not exist.",
      });
    }

    // Update name with uniqueness check
    if (minifigName !== undefined) {
      if (!minifigName || !String(minifigName).trim()) {
        return res.status(400).json({
          success: false,
          message: "Minifig name is required",
          description: "Please provide a valid name.",
        });
      }

      const checkName = String(minifigName).trim();
      const checkColorId = colorId || inventory.colorId;

      if (
        checkName !== inventory.minifigName ||
        (colorId && colorId !== inventory.colorId.toString())
      ) {
        const existing = await checkNameConflict(
          GeneralInventory,
          "minifigName",
          checkName,
          id,
          { colorId: checkColorId },
        );

        if (existing) {
          return res.status(409).json({
            success: false,
            message: "Duplicate item",
            description: "An item with this name and color already exists.",
          });
        }
      }
      inventory.minifigName = checkName;
    }

    if (itemId !== undefined) {
      inventory.itemId = itemId ? String(itemId).trim() : null;
    }

    if (pricePerBag !== undefined) {
      if (Number(pricePerBag) <= 0) {
        return res.status(400).json({
          success: false,
          message: "Price per bag must be greater than zero",
          description: "Please provide a valid positive price per bag.",
        });
      }
      inventory.pricePerBag = Number(pricePerBag);
    }

    if (piecesPerBag !== undefined) {
      if (!Number.isInteger(Number(piecesPerBag)) || Number(piecesPerBag) < 1) {
        return res.status(400).json({
          success: false,
          message: "Pieces per bag must be a positive integer",
          description: "Please provide a valid pieces-per-bag value (≥ 1).",
        });
      }
      inventory.piecesPerBag = Number(piecesPerBag);
    }

    // Admin cost note — optional, clearable with null/"".
    if (cost !== undefined) {
      if (cost === null || cost === "") {
        inventory.cost = null;
      } else if (isNaN(Number(cost)) || Number(cost) < 0) {
        return res.status(400).json({
          success: false,
          message: "Cost must be a non-negative number",
          description: "Please provide a valid cost value (≥ 0).",
        });
      } else {
        inventory.cost = Number(cost);
      }
    }

    // Admin bin location — optional free-form text, clearable with null/"".
    if (bin !== undefined) {
      inventory.bin =
        bin === null || String(bin).trim() === "" ? null : String(bin).trim();
    }

    if (stock !== undefined) {
      if (!Number.isInteger(Number(stock)) || Number(stock) < 0) {
        return res.status(400).json({
          success: false,
          message: "Stock must be an integer >= 0",
          description:
            "Please provide a valid non-negative integer for stock (bags).",
        });
      }
      inventory.stock = Number(stock);
    }

    if (colorId !== undefined) {
      const color = await Color.findById(colorId);
      if (!color) {
        return res.status(404).json({
          success: false,
          message: "Color not found",
          description: "The selected color does not exist.",
        });
      }
      inventory.colorId = colorId;
    }

    // New image uploaded directly to Cloudinary by the browser: swap the stored
    // reference and clean up the previous asset if it actually changed.
    if (image !== undefined && image !== null) {
      try {
        const newImage = normalizeImageRef(image);
        const oldPublicId = inventory.image?.publicId;
        if (newImage.publicId !== oldPublicId) {
          inventory.image = newImage;
          if (oldPublicId) deleteSingleImage(oldPublicId);
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Failed to update image",
          description: error.message,
        });
      }
    }

    if (isActive !== undefined) {
      // Deactivating an item that's live in a dealer add-on would silently drop
      // it from that add-on — block it so the admin removes it from those first.
      // Torso bags are unaffected: a bag shows its torsos regardless of the
      // torso's own active status, so we don't check torso bags here.
      const turningOff =
        Boolean(isActive) === false && inventory.isActive !== false;
      if (turningOff) {
        const conflict = inUseConflict({
          addons: await findAddonsUsingInventoryItem(id),
        });
        if (conflict) {
          return res.status(409).json(conflict);
        }
      }
      inventory.isActive = Boolean(isActive);
    }

    // The badge is a simple curation label — no in-use guard needed. One badge
    // at a time: assigning a new one replaces whatever was there.
    if (badge !== undefined) {
      inventory.badge = normalizeItemBadge(badge);
    }

    if (category !== undefined) {
      if (!INVENTORY_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category",
          description: `Category must be one of: ${INVENTORY_CATEGORIES.join(", ")}.`,
        });
      }
      // Enforce collection required for minifigs
      const effectiveCollectionIds = hasCollectionUpdate
        ? collectionIdList
        : inventory.collectionIds;
      if (category === "minifigs" && effectiveCollectionIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Collection is required",
          description:
            "At least one collection must be assigned to minifig items.",
        });
      }

      // Enforce part type required for bulk-minifig-parts
      const effectivePartType =
        partType !== undefined ? partType : inventory.partType;
      if (category === "bulk-minifig-parts") {
        if (!effectivePartType) {
          return res.status(400).json({
            success: false,
            message: "Part type is required",
            description: "A part type must be assigned to bulk minifig parts.",
          });
        }
        if (!BULK_MINIFIG_PART_TYPES.includes(effectivePartType)) {
          return res.status(400).json({
            success: false,
            message: "Invalid part type",
            description: `Part type must be one of: ${BULK_MINIFIG_PART_TYPES.join(", ")}.`,
          });
        }
      }
      inventory.category = category;
    }

    if (hasCollectionUpdate) {
      if (collectionIdList.length === 0) {
        inventory.collectionIds = [];
      } else {
        const found = await Collection.countDocuments({
          _id: { $in: collectionIdList },
        });
        if (found !== collectionIdList.length) {
          return res.status(404).json({
            success: false,
            message: "Collection not found",
            description: "One or more selected collections do not exist.",
          });
        }
        inventory.collectionIds = collectionIdList;
      }
    }

    if (partType !== undefined) {
      if (partType === null || partType === "") {
        inventory.partType = null;
      } else {
        if (!BULK_MINIFIG_PART_TYPES.includes(partType)) {
          return res.status(400).json({
            success: false,
            message: "Invalid part type",
            description: `Part type must be one of: ${BULK_MINIFIG_PART_TYPES.join(", ")}.`,
          });
        }
        inventory.partType = partType;
      }
    }

    inventory.updatedBy = req.user._id;
    await inventory.save();

    await inventory.populate([
      { path: "colorId", select: "colorName hexCode" },
      { path: "collectionIds", select: "collectionName" },
    ]);

    return res.status(200).json({
      success: true,
      message: "Inventory item updated successfully",
      inventory,
    });
  } catch (error) {
    console.error("Update inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update inventory item",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Delete General Inventory ------------------------------------------
export const deleteGeneralInventory = async (req, res) => {
  try {
    const { id } = req.params;

    const inventory = await GeneralInventory.findById(id).lean();

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
        description: "The requested inventory item does not exist.",
      });
    }

    // Block deletion when this item is still referenced by a dealer add-on or a
    // torso bag — deleting removes its image and dangles those references, so the
    // admin must remove it from those first.
    const [addons, torsoBags] = await Promise.all([
      findAddonsUsingInventoryItem(id),
      findTorsoBagsUsingInventoryItem(id),
    ]);
    const conflict = inUseConflict({ addons, torsoBags });
    if (conflict) {
      return res.status(409).json(conflict);
    }

    await GeneralInventory.findByIdAndDelete(id);

    // Delete image in background (fire-and-forget)
    deleteSingleImage(inventory.image?.publicId);

    return res.status(200).json({
      success: true,
      message: "Inventory item deleted successfully",
    });
  } catch (error) {
    console.error("Delete inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete inventory item",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};
