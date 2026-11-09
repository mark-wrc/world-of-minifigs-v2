import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import GeneralInventory from "../models/generalInventory.model.js";
import DealerTorsoBag from "../models/dealerTorsoBag.model.js";
import DealerAddon from "../models/dealerAddon.model.js";
import { normalizePagination } from "../utils/pagination.js";
import { ORDER_STATUSES } from "../constants/orderConstants.js";
import { updateOrderStatus } from "./orderController.js";

// Read and update access for Odoo. Lists are sorted oldest change first, so
// Odoo can ask for "everything changed since <time>" and page through it.

//------------------------------------------------ Helpers ------------------------------------------

const ORDER_USER_FIELDS = "firstName lastName email contactNumber role";
const ORDER_SHIPMENT_FIELDS = "status orders shipping email";
const HIDDEN_ORDER_FIELDS = "-cancellation.isLocked -cancellation.lockExpiresAt";
const HIDDEN_ITEM_FIELDS = "-createdBy -updatedBy";

// Odoo may not have a tracking link; build one for the common carriers.
const TRACKING_LINKS = {
  usps: "https://tools.usps.com/go/TrackConfirmAction?tLabels=",
  ups: "https://www.ups.com/track?tracknum=",
  fedex: "https://www.fedex.com/fedextrack/?trknbr=",
  dhl: "https://www.dhl.com/en/express/tracking.html?AWB=",
};

const buildTrackingLink = (carrier, trackingNumber) => {
  const key = String(carrier || "").toLowerCase().replace(/[^a-z]/g, "");
  const base = Object.entries(TRACKING_LINKS).find(([name]) =>
    key.startsWith(name),
  )?.[1];
  return base && trackingNumber
    ? base + encodeURIComponent(String(trackingNumber).trim())
    : undefined;
};

// Builds { filter, error } for the shared list options: updatedSince (ISO date/time).
const buildChangedSinceFilter = (updatedSince) => {
  if (!updatedSince) return { filter: {} };
  const since = new Date(updatedSince);
  if (Number.isNaN(since.getTime())) {
    return {
      error: {
        success: false,
        message: "Invalid updatedSince",
        description: "Use a date and time like 2026-11-08T22:00:00Z.",
      },
    };
  }
  return { filter: { updatedAt: { $gte: since } } };
};

const sendList = async (res, model, filter, query, key, build) => {
  const { page, limit } = normalizePagination(query);
  const [items, total] = await Promise.all([
    build(
      model
        .find(filter)
        .sort({ updatedAt: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ).lean(),
    model.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    [key]: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
};

const populateOrder = (query) =>
  query
    .select(HIDDEN_ORDER_FIELDS)
    .populate("userId", ORDER_USER_FIELDS)
    .populate("shipmentId", ORDER_SHIPMENT_FIELDS);

const serverError = (res, label, error) => {
  console.error(`Integration ${label} error:`, error);
  return res.status(500).json({
    success: false,
    message: `Failed to ${label}`,
    description: "An unexpected error occurred. Please try again.",
  });
};

//------------------------------------------------ Orders ------------------------------------------

// GET /orders?updatedSince=&status=paid,on_hold&orderType=product&page=&limit=
export const getIntegrationOrders = async (req, res) => {
  try {
    const { filter, error } = buildChangedSinceFilter(req.query.updatedSince);
    if (error) return res.status(400).json(error);

    if (req.query.status) {
      filter.status = { $in: String(req.query.status).split(",") };
    }
    if (req.query.orderType) {
      filter.orderType = { $in: String(req.query.orderType).split(",") };
    }

    return await sendList(res, Order, filter, req.query, "orders", populateOrder);
  } catch (error) {
    return serverError(res, "get orders", error);
  }
};

// GET /orders/:id
export const getIntegrationOrderById = async (req, res) => {
  try {
    const order = mongoose.isValidObjectId(req.params.id)
      ? await populateOrder(Order.findById(req.params.id)).lean()
      : null;

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
        description: "The requested order does not exist.",
      });
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    return serverError(res, "get order", error);
  }
};

// PATCH /orders/:id/status
//   { status: "shipped", carrier, trackingNumber, trackingLink? }
//   { status: "delivered", deliveryMethod: "hand_delivered" | "store_pickup", receivedBy?, notes? }
// Uses the same rules and customer emails as the admin screen. Cancelling stays
// in the website admin, because it refunds the customer.
export const updateIntegrationOrderStatus = async (req, res) => {
  const { status, carrier, trackingNumber } = req.body || {};

  if (![ORDER_STATUSES.SHIPPED, ORDER_STATUSES.DELIVERED].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Unsupported status",
      description:
        'Odoo can mark orders "shipped" or "delivered". Cancel orders in the website admin.',
    });
  }

  try {
    // Sending the same shipment twice is fine: nothing changes the second time.
    if (status === ORDER_STATUSES.SHIPPED && mongoose.isValidObjectId(req.params.id)) {
      const order = await Order.findById(req.params.id)
        .select("status shipping")
        .lean();
      if (
        order?.status === ORDER_STATUSES.SHIPPED &&
        order.shipping?.trackingNumber === String(trackingNumber || "").trim()
      ) {
        return res.status(200).json({
          success: true,
          message: "Order already marked as shipped",
          order: { _id: order._id, status: order.status, shipping: order.shipping },
        });
      }
    }
  } catch (error) {
    return serverError(res, "update order status", error);
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
      description: "The requested order does not exist.",
    });
  }

  for (const field of ["carrier", "trackingNumber", "trackingLink", "receivedBy", "notes", "deliveryMethod"]) {
    const value = req.body[field];
    if (value === null || value === undefined) delete req.body[field];
    else if (typeof value !== "string") req.body[field] = String(value);
  }

  if (status === ORDER_STATUSES.SHIPPED && !req.body.trackingLink) {
    req.body.trackingLink = buildTrackingLink(carrier, trackingNumber);
  }

  // req.user is the Odoo admin account (or no one, if it isn't set up).
  return updateOrderStatus(req, res);
};

//------------------------------------------------ Products ------------------------------------------

// GET /products?updatedSince=&page=&limit=
export const getIntegrationProducts = async (req, res) => {
  try {
    const { filter, error } = buildChangedSinceFilter(req.query.updatedSince);
    if (error) return res.status(400).json(error);

    return await sendList(res, Product, filter, req.query, "products", (query) =>
      query
        .select(HIDDEN_ITEM_FIELDS)
        .populate("colorId secondaryColorId variants.colorId variants.secondaryColorId", "colorName hexCode"),
    );
  } catch (error) {
    return serverError(res, "get products", error);
  }
};

// GET /inventory?updatedSince=&page=&limit=
// Dealer / wholesale inventory; stock is counted in bags.
export const getIntegrationInventory = async (req, res) => {
  try {
    const { filter, error } = buildChangedSinceFilter(req.query.updatedSince);
    if (error) return res.status(400).json(error);

    return await sendList(res, GeneralInventory, filter, req.query, "inventory", (query) =>
      query.select(HIDDEN_ITEM_FIELDS).populate("colorId", "colorName hexCode"),
    );
  } catch (error) {
    return serverError(res, "get inventory", error);
  }
};

//------------------------------------------------ Stock ------------------------------------------

// What Odoo can set stock on. Products are matched by their own item ID or a
// variant's item ID; inventory by item ID; bags and add-ons by their id.
const STOCK_TYPES = {
  product: Product,
  inventory: GeneralInventory,
  "torso-bag": DealerTorsoBag,
  addon: DealerAddon,
};
const MAX_STOCK_ROWS = 200;
// Item IDs are matched ignoring upper/lower case, like the product item ID index.
const ITEM_ID_COLLATION = { locale: "en", strength: 2 };

// Guards against a mistyped count (an extra few zeros) reaching the store.
const MAX_STOCK = 1000000;

const isWholeNumber = (value) => Number.isInteger(value) && Math.abs(value) <= MAX_STOCK;

// Finds the one document a row points at: { model, docId, variantItemId } or { error }.
const resolveStockRow = async (row) => {
  const model = Object.hasOwn(STOCK_TYPES, row.type) ? STOCK_TYPES[row.type] : null;
  if (!model) {
    return { error: `type must be one of: ${Object.keys(STOCK_TYPES).join(", ")}` };
  }

  const filter = {};
  let variantItemId = row.variantItemId ? String(row.variantItemId).trim() : null;
  if (row.id) {
    if (!mongoose.isValidObjectId(row.id)) return { error: "Item not found" };
    filter._id = row.id;
  } else if (row.itemId && ["product", "inventory"].includes(row.type)) {
    const itemId = String(row.itemId).trim();
    if (row.type === "product") {
      const standalone = await Product.countDocuments({ productType: "standalone", itemId }).collation(ITEM_ID_COLLATION);
      if (standalone) filter.itemId = itemId;
      else variantItemId = itemId;
    } else {
      filter.itemId = itemId;
    }
  } else {
    return { error: "Send the item's id (or itemId for products and inventory)" };
  }

  if (variantItemId) {
    if (row.type !== "product") return { error: "variantItemId is only for products" };
    filter["variants.itemId"] = variantItemId;
  }

  const found = await model.find(filter).collation(ITEM_ID_COLLATION).select("_id productType").limit(3).lean();
  if (found.length === 0) return { error: "Item not found" };
  if (found.length > 1) return { error: "itemId matches more than one item; send the id instead" };
  // A product with colors keeps its stock per color.
  if (row.type === "product" && !variantItemId && found[0].productType === "variant") {
    return { error: "This product has colors; send variantItemId for the color to change" };
  }
  return { model, docId: found[0]._id, variantItemId };
};

// Sets ({ stock }) or adjusts ({ change }) one row's stock. Returns the result row.
const applyStockRow = async (row, userId) => {
  const setting = row.stock !== undefined;
  if (setting === (row.change !== undefined)) {
    return { error: "Send either stock (the new count) or change (amount to add or remove)" };
  }
  const allowsUntracked = row.type === "addon";
  if (setting && !(isWholeNumber(row.stock) && row.stock >= 0) && !(allowsUntracked && row.stock === null)) {
    return { error: `stock must be a whole number from 0 to ${MAX_STOCK}` };
  }
  if (!setting && !(isWholeNumber(row.change) && row.change !== 0)) {
    return { error: `change must be a whole number other than 0 (at most ${MAX_STOCK})` };
  }

  const resolved = await resolveStockRow(row);
  if (resolved.error) return resolved;
  const { model, docId, variantItemId } = resolved;

  const path = variantItemId ? "variants.$.stock" : "stock";
  const audit = userId ? { updatedBy: userId } : {};
  // Removing stock never takes it below zero (and can't touch an untracked add-on).
  const enough = setting ? undefined : { $gte: Math.max(0, -row.change) };
  const filter = { _id: docId };
  if (variantItemId) {
    // The exact variant item ID as stored (the lookup above ignored case).
    const doc = await model.findById(docId).select("variants.itemId").lean();
    const stored = doc?.variants?.find((v) => v.itemId?.toLowerCase() === variantItemId.toLowerCase())?.itemId;
    if (!stored) return { error: "Item not found" };
    filter.variants = { $elemMatch: { itemId: stored, ...(enough ? { stock: enough } : {}) } };
  } else if (enough) {
    filter.stock = enough;
  }
  const update = setting
    ? { $set: { [path]: row.stock, ...audit } }
    : { $inc: { [path]: row.change }, ...(userId ? { $set: audit } : {}) };

  const result = await model.updateOne(filter, update);
  if (result.matchedCount === 0) {
    const exists = await model.exists({ _id: docId });
    return { error: exists ? "Not enough stock to remove that many (or stock isn't tracked)" : "Item not found" };
  }

  const saved = await model
    .findById(docId)
    .select("stock variants.itemId variants.stock")
    .lean();
  const stock = variantItemId
    ? saved?.variants?.find((v) => v.itemId?.toLowerCase() === variantItemId.toLowerCase())?.stock
    : saved?.stock;
  return { id: saved?._id, stock };
};

// PATCH /stock  { items: [ { type, id | itemId, variantItemId?, stock | change } ] }
// Each row is applied on its own; the reply says how each one went.
export const updateIntegrationStock = async (req, res) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_STOCK_ROWS) {
    return res.status(400).json({
      success: false,
      message: "Invalid items",
      description: `Send items: a list of 1 to ${MAX_STOCK_ROWS} stock changes.`,
    });
  }

  try {
    const results = [];
    for (const row of items) {
      const result = await applyStockRow(row || {}, req.user?._id);
      results.push({
        type: row?.type,
        id: row?.id,
        itemId: row?.itemId,
        variantItemId: row?.variantItemId,
        ...(result.error ? { ok: false, error: result.error } : { ok: true, ...result }),
      });
    }

    const failed = results.filter((r) => !r.ok).length;
    return res.status(200).json({
      success: failed === 0,
      message: failed ? `${failed} of ${results.length} not updated` : "Stock updated",
      results,
    });
  } catch (error) {
    return serverError(res, "update stock", error);
  }
};
