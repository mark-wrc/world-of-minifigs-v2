import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import GeneralInventory from "../models/generalInventory.model.js";
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

  if (status === ORDER_STATUSES.SHIPPED && !req.body.trackingLink) {
    req.body.trackingLink = buildTrackingLink(carrier, trackingNumber);
  }

  // No staff member made this change; the order records no "by" user.
  req.user = { _id: undefined };
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
