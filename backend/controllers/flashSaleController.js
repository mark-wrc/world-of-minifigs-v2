import FlashSale from "../models/flashSale.model.js";
import GeneralInventory from "../models/generalInventory.model.js";
import {
  normalizePagination,
  buildSearchQuery,
  paginateQuery,
  createPaginationResponse,
} from "../utils/pagination.js";
import { handleError } from "../utils/commonUtils.js";
import { AUDIT_POPULATE } from "../utils/populateHelpers.js";
import { getFlashSaleStatus, round2 } from "../utils/flashSale/resolver.js";

// Populate spec for participant items — enough for the admin picker/preview.
const ITEM_POPULATE = {
  path: "items.inventoryItemId",
  select: "minifigName pricePerBag image colorId category isActive",
  populate: { path: "colorId", select: "colorName hexCode" },
};

// Parse a date input and return a valid Date or null.
const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

// Validate the window. Returns { error } or { startAt, endAt }.
const validateWindow = (startAtRaw, endAtRaw) => {
  const startAt = parseDate(startAtRaw);
  const endAt = parseDate(endAtRaw);
  if (!startAt || !endAt) {
    return { error: "A valid start and end date/time are required." };
  }
  if (endAt <= startAt) {
    return { error: "End date/time must be after the start date/time." };
  }
  return { startAt, endAt };
};

// Validate + normalize the participant items against live inventory. Returns
// { error } (400 body message) or { items } ready to persist.
const validateItems = async (rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: "Add at least one item to the flash sale." };
  }

  // De-dupe by inventory id (last one wins) so an item can't appear twice.
  const byId = new Map();
  for (const it of rawItems) {
    const id = it?.inventoryItemId ? String(it.inventoryItemId) : null;
    if (!id) return { error: "Every sale item must reference an inventory item." };
    byId.set(id, it);
  }

  const ids = [...byId.keys()];
  const inventories = await GeneralInventory.find({ _id: { $in: ids } })
    .select("minifigName pricePerBag isActive")
    .lean();
  const invMap = new Map(inventories.map((i) => [String(i._id), i]));

  const items = [];
  for (const [id, it] of byId) {
    const inv = invMap.get(id);
    if (!inv) {
      return { error: "One or more selected items no longer exist." };
    }
    if (!inv.isActive) {
      return {
        error: `"${inv.minifigName}" is inactive and cannot be put on sale.`,
      };
    }

    const discountType = it.discountType;
    if (discountType !== "percent" && discountType !== "fixed") {
      return {
        error: `Discount type for "${inv.minifigName}" must be "percent" or "fixed".`,
      };
    }

    const discountValue = Number(it.discountValue);
    if (isNaN(discountValue) || discountValue <= 0) {
      return {
        error: `Enter a discount greater than 0 for "${inv.minifigName}".`,
      };
    }
    if (discountType === "percent" && discountValue > 100) {
      return {
        error: `Percentage discount for "${inv.minifigName}" cannot exceed 100%.`,
      };
    }
    if (discountType === "fixed" && discountValue >= inv.pricePerBag) {
      return {
        error: `Fixed discount for "${inv.minifigName}" must be less than its price ($${round2(
          inv.pricePerBag,
        )}).`,
      };
    }

    items.push({
      inventoryItemId: id,
      discountType,
      discountValue,
      basePriceAtAdd: round2(inv.pricePerBag),
    });
  }

  return { items };
};

// Reject items already committed to another sale whose window overlaps this one.
// Two windows overlap when each starts before the other ends. Returns a 409
// body string, or null when clear.
const findOverlapConflict = async (startAt, endAt, itemIds, excludeId = null) => {
  const query = {
    "items.inventoryItemId": { $in: itemIds },
    startAt: { $lte: endAt },
    endAt: { $gte: startAt },
  };
  if (excludeId) query._id = { $ne: excludeId };

  const overlapping = await FlashSale.find(query)
    .select("name items.inventoryItemId")
    .populate("items.inventoryItemId", "minifigName")
    .lean();

  if (overlapping.length === 0) return null;

  const wanted = new Set(itemIds.map(String));
  const clashes = [];
  for (const sale of overlapping) {
    for (const line of sale.items || []) {
      const inv = line.inventoryItemId;
      if (inv && wanted.has(String(inv._id))) {
        clashes.push(`"${inv.minifigName}" (in "${sale.name}")`);
      }
    }
  }
  if (clashes.length === 0) return null;

  return `These items already belong to an overlapping flash sale: ${[
    ...new Set(clashes),
  ].join(", ")}. Adjust the window or remove them first.`;
};

// Attach derived status + item count to a lean sale doc for list/detail responses.
const decorate = (sale, now = new Date()) => ({
  ...sale,
  status: getFlashSaleStatus(sale, now),
  itemCount: sale.items?.length || 0,
});

//------------------------------------------------ Create ------------------------------------------
export const createFlashSale = async (req, res) => {
  try {
    const { name, startAt, endAt, isEnabled, items } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
        description: "Please give the flash sale a name.",
      });
    }

    const window = validateWindow(startAt, endAt);
    if (window.error) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale window",
        description: window.error,
      });
    }

    const validated = await validateItems(items);
    if (validated.error) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale items",
        description: validated.error,
      });
    }

    const conflict = await findOverlapConflict(
      window.startAt,
      window.endAt,
      validated.items.map((i) => i.inventoryItemId),
    );
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: "Overlapping flash sale",
        description: conflict,
      });
    }

    const sale = await FlashSale.create({
      name: String(name).trim(),
      startAt: window.startAt,
      endAt: window.endAt,
      isEnabled: isEnabled === undefined ? true : Boolean(isEnabled),
      items: validated.items,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Flash sale created successfully",
      flashSale: decorate(sale.toObject()),
    });
  } catch (error) {
    handleError(res, error, "Create flash sale", "Failed to create flash sale");
  }
};

//------------------------------------------------ Get All ------------------------------------------
export const getAllFlashSales = async (req, res) => {
  try {
    const { page, limit, search } = normalizePagination(req.query);
    const { status } = req.query;

    let query = {};
    if (search) {
      query = buildSearchQuery(search, ["name"]);
    }

    // Status is derived from the clock, so translate the filter into a date query.
    const now = new Date();
    if (status === "scheduled") {
      query.startAt = { $gt: now };
    } else if (status === "active") {
      query.isEnabled = true;
      query.startAt = { $lte: now };
      query.endAt = { $gte: now };
    } else if (status === "ended") {
      query.endAt = { $lt: now };
    } else if (status === "paused") {
      query.isEnabled = false;
      query.startAt = { $lte: now };
      query.endAt = { $gte: now };
    }

    const result = await paginateQuery(FlashSale, query, {
      page,
      limit,
      sort: { createdAt: -1 },
      // Populate participant items too so the admin edit form has full item data
      // (name, price, image) without a second round-trip.
      populate: [ITEM_POPULATE, ...AUDIT_POPULATE],
    });

    result.data = result.data.map((s) => decorate(s, now));

    return res
      .status(200)
      .json(createPaginationResponse(result, "flashSales"));
  } catch (error) {
    handleError(res, error, "Get flash sales", "Failed to fetch flash sales");
  }
};

//------------------------------------------------ Get By Id ------------------------------------------
export const getFlashSaleById = async (req, res) => {
  try {
    const sale = await FlashSale.findById(req.params.id)
      .populate(ITEM_POPULATE)
      .populate(AUDIT_POPULATE)
      .lean();

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Flash sale not found",
        description: "The requested flash sale does not exist.",
      });
    }

    return res.status(200).json({
      success: true,
      flashSale: decorate(sale),
    });
  } catch (error) {
    handleError(res, error, "Get flash sale", "Failed to fetch flash sale");
  }
};

//------------------------------------------------ Update ------------------------------------------
export const updateFlashSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startAt, endAt, isEnabled, items } = req.body;

    const sale = await FlashSale.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Flash sale not found",
        description: "The requested flash sale does not exist.",
      });
    }

    if (name !== undefined) {
      if (!name || !String(name).trim()) {
        return res.status(400).json({
          success: false,
          message: "Name is required",
          description: "Please give the flash sale a name.",
        });
      }
      sale.name = String(name).trim();
    }

    // Window can be updated partially — validate the effective pair.
    const effStart = startAt !== undefined ? startAt : sale.startAt;
    const effEnd = endAt !== undefined ? endAt : sale.endAt;
    if (startAt !== undefined || endAt !== undefined) {
      const window = validateWindow(effStart, effEnd);
      if (window.error) {
        return res.status(400).json({
          success: false,
          message: "Invalid sale window",
          description: window.error,
        });
      }
      sale.startAt = window.startAt;
      sale.endAt = window.endAt;
    }

    if (isEnabled !== undefined) {
      sale.isEnabled = Boolean(isEnabled);
    }

    if (items !== undefined) {
      const validated = await validateItems(items);
      if (validated.error) {
        return res.status(400).json({
          success: false,
          message: "Invalid sale items",
          description: validated.error,
        });
      }
      sale.items = validated.items;
    }

    // Re-check overlap against the effective window + items (excluding self).
    const conflict = await findOverlapConflict(
      sale.startAt,
      sale.endAt,
      sale.items.map((i) => String(i.inventoryItemId)),
      id,
    );
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: "Overlapping flash sale",
        description: conflict,
      });
    }

    sale.updatedBy = req.user._id;
    await sale.save();

    return res.status(200).json({
      success: true,
      message: "Flash sale updated successfully",
      flashSale: decorate(sale.toObject()),
    });
  } catch (error) {
    handleError(res, error, "Update flash sale", "Failed to update flash sale");
  }
};

//------------------------------------------------ Delete ------------------------------------------
export const deleteFlashSale = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await FlashSale.findById(id).lean();

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Flash sale not found",
        description: "The requested flash sale does not exist.",
      });
    }

    // Deleting a currently-active sale would abruptly change live prices — guide
    // the admin to pause it first (which they can, via isEnabled) instead.
    if (getFlashSaleStatus(sale) === "active") {
      return res.status(409).json({
        success: false,
        message: "Sale is active",
        description:
          "This flash sale is currently running. Pause it (disable) or wait for it to end before deleting.",
      });
    }

    await FlashSale.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Flash sale deleted successfully",
    });
  } catch (error) {
    handleError(res, error, "Delete flash sale", "Failed to delete flash sale");
  }
};

//------------------------------------------------ Duplicate ------------------------------------------
// Clone a sale's name + items so it can be re-run with a fresh window. The copy
// is created disabled with a window shifted to start "now" (admin edits before
// enabling) to avoid overlapping the original.
export const duplicateFlashSale = async (req, res) => {
  try {
    const { id } = req.params;
    const source = await FlashSale.findById(id).lean();

    if (!source) {
      return res.status(404).json({
        success: false,
        message: "Flash sale not found",
        description: "The requested flash sale does not exist.",
      });
    }

    const durationMs =
      new Date(source.endAt).getTime() - new Date(source.startAt).getTime();
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + Math.max(durationMs, 3600000));

    const copy = await FlashSale.create({
      name: `${source.name} (Copy)`,
      startAt,
      endAt,
      isEnabled: false, // staged — admin sets the real window then enables
      items: (source.items || []).map((i) => ({
        inventoryItemId: i.inventoryItemId,
        discountType: i.discountType,
        discountValue: i.discountValue,
        basePriceAtAdd: i.basePriceAtAdd,
      })),
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Flash sale duplicated. Set its window and enable it when ready.",
      flashSale: decorate(copy.toObject()),
    });
  } catch (error) {
    handleError(
      res,
      error,
      "Duplicate flash sale",
      "Failed to duplicate flash sale",
    );
  }
};
