import GeneralInventory, {
  INVENTORY_CATEGORIES,
} from "../models/generalInventory.model.js";
import Collection from "../models/collection.model.js";
import Color from "../models/color.model.js";
import DealerAddon from "../models/dealerAddon.model.js";
import {
  uploadSingleImage,
  replaceSingleImage,
  deleteSingleImage,
} from "../services/imageService.js";
import {
  normalizePagination,
  buildSearchQuery,
  paginateQuery,
  createPaginationResponse,
} from "../utils/pagination.js";
import { checkNameConflict } from "../utils/commonUtils.js";
import { AUDIT_POPULATE } from "../utils/populateHelpers.js";

const IMAGE_FOLDER = "world-of-minifigs-v2/general-inventory";

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
        pricePerBag,
        piecesPerBag,
        stock,
        colorId,
        image,
        category,
        collectionId,
      } = item;

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
        throw new Error("Category must be accessories, animals, or minifigs");

      if (category === "minifigs" && !collectionId)
        throw new Error("Collection is required for minifig items");

      // Verify color exists
      const color = await Color.findById(colorId);
      if (!color) throw new Error("Selected color does not exist");

      // Verify collection exists when provided
      if (collectionId) {
        const col = await Collection.findById(collectionId);
        if (!col) throw new Error("Selected collection does not exist");
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

      // Upload image via imageService (validate + upload)
      const uploadedImage = await uploadSingleImage(image, IMAGE_FOLDER);

      const newInventory = await GeneralInventory.create({
        minifigName: String(minifigName).trim(),
        pricePerBag: Number(pricePerBag),
        piecesPerBag:
          piecesPerBag !== undefined && piecesPerBag !== null
            ? Number(piecesPerBag)
            : 1,
        stock: Number(stock),
        colorId,
        category,
        collectionId:
          category === "minifigs" && collectionId ? collectionId : null,
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
    const { category } = req.query;

    const baseFilter = {};

    if (category && INVENTORY_CATEGORIES.includes(category)) {
      baseFilter.category = category;
    }

    let searchQuery = { ...baseFilter };

    if (search) {
      const nameQuery = buildSearchQuery(search, ["minifigName"]);

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

    const result = await paginateQuery(GeneralInventory, searchQuery, {
      page,
      limit,
      sort: { createdAt: -1 },
      populate: [
        { path: "colorId", select: "colorName hexCode" },
        { path: "collectionId", select: "collectionName" },
        ...AUDIT_POPULATE,
      ],
    });

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
      pricePerBag,
      piecesPerBag,
      stock,
      colorId,
      image,
      isActive,
      category,
      collectionId,
    } = req.body;

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
      if (
        !Number.isInteger(Number(piecesPerBag)) ||
        Number(piecesPerBag) < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Pieces per bag must be a positive integer",
          description: "Please provide a valid pieces-per-bag value (≥ 1).",
        });
      }
      inventory.piecesPerBag = Number(piecesPerBag);
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

    // Replace image if new base64 provided via imageService
    if (image !== undefined && image !== null) {
      try {
        const uploaded = await replaceSingleImage(
          image,
          inventory.image,
          IMAGE_FOLDER,
        );
        if (uploaded) inventory.image = uploaded;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Failed to update image",
          description: error.message,
        });
      }
    }

    if (isActive !== undefined) {
      inventory.isActive = Boolean(isActive);
    }

    if (category !== undefined) {
      if (!INVENTORY_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category",
          description: "Category must be accessories, animals, or minifigs.",
        });
      }
      // Enforce collection required for minifigs
      const effectiveCollectionId =
        collectionId !== undefined ? collectionId : inventory.collectionId;
      if (category === "minifigs" && !effectiveCollectionId) {
        return res.status(400).json({
          success: false,
          message: "Collection is required",
          description: "A collection must be assigned to minifig items.",
        });
      }
      inventory.category = category;
    }

    if (collectionId !== undefined) {
      if (collectionId === null) {
        inventory.collectionId = null;
      } else {
        const col = await Collection.findById(collectionId);
        if (!col) {
          return res.status(404).json({
            success: false,
            message: "Collection not found",
            description: "The selected collection does not exist.",
          });
        }
        inventory.collectionId = collectionId;
      }
    }

    inventory.updatedBy = req.user._id;
    await inventory.save();

    await inventory.populate([
      { path: "colorId", select: "colorName hexCode" },
      { path: "collectionId", select: "collectionName" },
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

    // Block deletion when this inventory item is still referenced by dealer add-ons
    const usedByDealerAddons = await DealerAddon.find(
      { "bundleItems.inventoryItemId": id },
      "addonName",
    ).lean();

    if (usedByDealerAddons.length > 0) {
      const addonNames = usedByDealerAddons
        .map((a) => `"${a.addonName}"`)
        .join(", ");
      return res.status(409).json({
        success: false,
        message: "Inventory item is in use",
        description: `This item is used in the following dealer add-on(s): ${addonNames}. Remove it from those add-ons before deleting.`,
      });
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
