import Order from "../models/order.model.js";
import { ORDER_STATUSES } from "../constants/orderConstants.js";
import {
  BACKORDER_STATUSES,
  getOrderLines,
} from "../../shared/orderLines.js";

// Backorders (admin): hold some lines of an order back, ship the rest, and ship
// the held lines later with their own tracking. The order keeps one payment and
// its normal status — "Shipped" means Shipment 1 went out; the held lines are
// Shipment 2, 3, … on the same order. No emails are sent from here.

const bad = (res, message, description) =>
  res.status(400).json({ success: false, message, description });

const notFound = (res) =>
  res.status(404).json({
    success: false,
    message: "Order not found",
    description: "The requested order does not exist.",
  });

const serverError = (res, what, error) => {
  console.error(`${what} error:`, error);
  return res.status(500).json({
    success: false,
    message: `Failed to ${what.toLowerCase()}`,
    description: "An unexpected error occurred. Please try again.",
  });
};

// Shipment 1 hasn't left yet: lines can still be held back or put back.
const NOT_SHIPPED_YET = [ORDER_STATUSES.PAID, ORDER_STATUSES.ON_HOLD];
// Shipment 1 is out (shipped, or handed over): held lines can now ship.
const FIRST_SHIPMENT_OUT = [ORDER_STATUSES.SHIPPED, ORDER_STATUSES.DELIVERED];

const isWholeNumber = (n) => Number.isInteger(n) && n >= 0;

//------------------------------------------------ Set Backorder ------------------------------------------
// PUT /admin/orders/:id/backorder  { lines: [{ lineKey, quantity }], note }
// Sets how many of each line are held back, before Shipment 1 goes out. A
// quantity of 0 (or leaving a line out) puts it back into Shipment 1. Sending no
// lines clears the backorder.

export const setOrderBackorder = async (req, res) => {
  try {
    const { lines = [], note } = req.body || {};
    if (!Array.isArray(lines)) {
      return bad(res, "Invalid lines", "Send the lines as a list.");
    }

    const order = await Order.findById(req.params.id);
    if (!order) return notFound(res);

    if (!NOT_SHIPPED_YET.includes(order.status)) {
      return bad(
        res,
        "Order already shipped",
        "Items can only be backordered before the order ships. Ship the backordered items from the order instead.",
      );
    }

    const orderLines = new Map(getOrderLines(order).map((l) => [l.key, l]));
    const wanted = new Map();
    for (const line of lines) {
      const quantity = Number(line?.quantity);
      const orderLine = orderLines.get(line?.lineKey);
      if (!orderLine) {
        return bad(res, "Unknown line", "One of the lines is not on this order. Reload the order and try again.");
      }
      if (!isWholeNumber(quantity) || quantity > orderLine.quantity) {
        return bad(
          res,
          "Invalid quantity",
          `${orderLine.name}: backorder a whole number from 0 to ${orderLine.quantity}.`,
        );
      }
      if (wanted.has(line.lineKey)) {
        return bad(res, "Duplicate line", `${orderLine.name} is listed twice.`);
      }
      if (quantity > 0) wanted.set(line.lineKey, { orderLine, quantity });
    }

    // Something has to be left for Shipment 1 — if nothing is in stock, the
    // order simply stays "Paid" until it can ship.
    const everything = [...orderLines.values()].every(
      (l) => wanted.get(l.key)?.quantity === l.quantity,
    );
    if (wanted.size > 0 && everything) {
      return bad(
        res,
        "Nothing left to ship",
        "Every item would be backordered. Leave the order as it is until something can ship.",
      );
    }

    const cleanNote = typeof note === "string" ? note.trim().slice(0, 500) : "";
    // Lines already held keep when they were first held back.
    const before = new Map(
      (order.backorders || []).map((b) => [b.lineKey, b]),
    );
    order.backorders = wanted.size
      ? [...wanted.entries()].map(([lineKey, { orderLine, quantity }]) => ({
          lineKey,
          name: orderLine.group ? `${orderLine.name} (${orderLine.group})` : orderLine.name,
          quantity,
          generation: 2,
          status: BACKORDER_STATUSES.AWAITING,
          note: cleanNote || undefined,
          createdAt: before.get(lineKey)?.createdAt || new Date(),
          createdById: before.get(lineKey)?.createdById || req.user._id,
        }))
      : undefined;
    await order.save();

    return res.status(200).json({
      success: true,
      message: wanted.size ? "Backorder saved" : "Backorder cleared",
      description: wanted.size
        ? `${wanted.size} line${wanted.size === 1 ? "" : "s"} will ship later as Shipment 2.`
        : "Everything ships together again.",
      order: { _id: order._id, backorders: order.backorders },
    });
  } catch (error) {
    return serverError(res, "Save backorder", error);
  }
};

//------------------------------------------------ Ship Backorder ------------------------------------------
// POST /admin/orders/:id/backorder/ship
//   { carrier, trackingNumber, trackingLink, lines?: [{ lineKey, quantity }] }
// Ships the held lines once they're in. With no `lines`, everything still held
// ships. With `lines`, only those quantities ship; whatever is still missing
// stays held as the next shipment.

export const shipOrderBackorder = async (req, res) => {
  try {
    const { carrier, trackingNumber, trackingLink, lines } = req.body || {};
    const missing = [];
    if (!carrier?.trim()) missing.push("Carrier");
    if (!trackingNumber?.trim()) missing.push("Tracking Number");
    if (!trackingLink?.trim()) missing.push("Tracking Link");
    if (missing.length) {
      return bad(
        res,
        `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required`,
        "Please provide carrier, tracking number, and tracking link for the backordered items.",
      );
    }

    const order = await Order.findById(req.params.id);
    if (!order) return notFound(res);

    if (!FIRST_SHIPMENT_OUT.includes(order.status)) {
      return bad(
        res,
        "Ship the order first",
        order.status === ORDER_STATUSES.CANCELLED
          ? "This order was cancelled."
          : "Mark the order as shipped first (Shipment 1). The backordered items ship after it.",
      );
    }

    const awaiting = (order.backorders || []).filter(
      (b) => b.status === BACKORDER_STATUSES.AWAITING,
    );
    if (!awaiting.length) {
      return bad(res, "Nothing to ship", "This order has no backordered items waiting.");
    }

    // How many of each held line ship now (default: all of them).
    const shipNow = new Map(awaiting.map((b) => [b.lineKey, b.quantity]));
    if (Array.isArray(lines)) {
      for (const b of awaiting) shipNow.set(b.lineKey, 0);
      for (const line of lines) {
        const held = awaiting.find((b) => b.lineKey === line?.lineKey);
        const quantity = Number(line?.quantity);
        if (!held) {
          return bad(res, "Unknown line", "One of the lines is not backordered on this order.");
        }
        if (!isWholeNumber(quantity) || quantity > held.quantity) {
          return bad(res, "Invalid quantity", `${held.name}: ship a whole number from 0 to ${held.quantity}.`);
        }
        shipNow.set(held.lineKey, quantity);
      }
      if ([...shipNow.values()].every((q) => q === 0)) {
        return bad(res, "Nothing to ship", "Enter how many of at least one item are shipping.");
      }
    }

    const shipping = {
      carrier: carrier.trim(),
      trackingNumber: trackingNumber.trim(),
      trackingLink: trackingLink.trim(),
      shippedAt: new Date(),
    };
    const generation = Math.min(...awaiting.map((b) => b.generation));
    const added = [];
    let left = 0;
    for (const b of awaiting) {
      const quantity = shipNow.get(b.lineKey);
      if (quantity === b.quantity) {
        b.status = BACKORDER_STATUSES.SHIPPED;
        b.generation = generation;
        b.shipping = shipping;
        b.shippedById = req.user._id;
      } else {
        // Part (or none) ships now; the rest waits for the next shipment.
        if (quantity > 0) {
          added.push({
            lineKey: b.lineKey,
            name: b.name,
            quantity,
            generation,
            status: BACKORDER_STATUSES.SHIPPED,
            note: b.note,
            createdAt: b.createdAt,
            createdById: b.createdById,
            shipping,
            shippedById: req.user._id,
          });
        }
        b.quantity -= quantity;
        b.generation = generation + 1;
        left += 1;
      }
    }
    order.backorders.push(...added);
    await order.save();

    return res.status(200).json({
      success: true,
      message: `Shipment ${generation} marked as shipped`,
      description: left
        ? `${left} item${left === 1 ? " is" : "s are"} still backordered (Shipment ${generation + 1}).`
        : "Every backordered item has now shipped.",
      order: { _id: order._id, backorders: order.backorders },
    });
  } catch (error) {
    return serverError(res, "Ship backorder", error);
  }
};

//------------------------------------------------ Backorder Report ------------------------------------------
// GET /admin/orders/backorders
// Everything still waiting to ship, oldest order first, plus totals per item.

export const getBackorderReport = async (_req, res) => {
  try {
    const orders = await Order.find({
      status: { $ne: ORDER_STATUSES.CANCELLED },
      "backorders.status": BACKORDER_STATUSES.AWAITING,
    })
      .select("status orderType email createdAt payment.receiptNumber payment.stripeInvoiceNumber payment.paidAt backorders userId")
      .populate({ path: "userId", select: "firstName lastName" })
      .sort({ createdAt: 1 })
      .limit(2000)
      .lean();

    const lines = [];
    const byItem = new Map();
    for (const order of orders) {
      const invoice =
        order.payment?.receiptNumber ||
        order.payment?.stripeInvoiceNumber ||
        String(order._id).substring(0, 7);
      for (const b of order.backorders || []) {
        if (b.status !== BACKORDER_STATUSES.AWAITING) continue;
        lines.push({
          orderId: order._id,
          invoice,
          customer: [order.userId?.firstName, order.userId?.lastName].filter(Boolean).join(" "),
          email: order.email,
          orderType: order.orderType,
          orderStatus: order.status,
          orderedAt: order.createdAt,
          lineKey: b.lineKey,
          name: b.name,
          quantity: b.quantity,
          shipment: b.generation,
          note: b.note,
          backorderedAt: b.createdAt,
        });
        const item = byItem.get(b.name) || { name: b.name, quantity: 0, orders: 0 };
        item.quantity += b.quantity;
        item.orders += 1;
        byItem.set(b.name, item);
      }
    }

    return res.status(200).json({
      success: true,
      orders: orders.length,
      lines,
      byItem: [...byItem.values()].sort((a, b) => b.quantity - a.quantity),
    });
  } catch (error) {
    return serverError(res, "Load backorder report", error);
  }
};
