import Order from "../models/order.model.js";
import { ORDER_STATUSES } from "../constants/orderConstants.js";
import {
  BACKORDER_STATUSES,
  REFUND_ENTRY_STATUSES,
  RESTOCK_STATUSES,
  getOrderLines,
  getRefundedTotal,
  refundedQuantityByKey,
  awaitingQuantityByKey,
} from "../../shared/orderLines.js";
import { getOrderGateway } from "../services/payment/gateways/index.js";
import {
  getLineStockTarget,
  restockOrderLines,
} from "../utils/payment/stockManager.js";
import { sendRefundIssuedEmail } from "../services/orderEmailService.js";
import { getCancellationRefundAmount } from "../services/shipmentService.js";

// Refunds without cancelling (admin): refund some items and/or an amount of a
// paid order through the gateway that took the payment (Stripe or Square).
// An order can have several; they are kept in order.refunds. Cancelling an
// order still refunds through order.refund as before (only what's left).
//
// - Picked items that were backordered come off the backorder (they aren't
//   coming); those never came in, so they are never put back in stock.
// - The rest of the picked items go back into the website's stock right away,
//   unless staff choose to hold that until later ("Put back in stock" button).
// - The customer gets a "refund issued" email.

const bad = (res, message, description, status = 400) =>
  res.status(status).json({ success: false, message, description });

const notFound = (res) =>
  bad(res, "Order not found", "The requested order does not exist.", 404);

const serverError = (res, what, error) => {
  console.error(`${what} error:`, error);
  return res.status(500).json({
    success: false,
    message: `Failed to ${what.toLowerCase()}`,
    description: "An unexpected error occurred. Please try again.",
  });
};

const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => `$${Number(n).toFixed(2)}`;
const LOCK_MS = 2 * 60 * 1000;

// Orders that have been paid and not cancelled.
const REFUNDABLE = [
  ORDER_STATUSES.PAID,
  ORDER_STATUSES.ON_HOLD,
  ORDER_STATUSES.SHIPPED,
  ORDER_STATUSES.DELIVERED,
];
const NOT_SHIPPED_YET = [ORDER_STATUSES.PAID, ORDER_STATUSES.ON_HOLD];

const isWholeNumber = (n) => Number.isInteger(n) && n >= 0;
const isCents = (n) =>
  Number.isFinite(n) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

const refundView = (order) => ({
  _id: order._id,
  refunds: order.refunds,
  backorders: order.backorders,
});

// Takes the refunded quantities off the waiting backorder entries (latest
// shipment first). `lines` are the refund's lines; sets each line's
// `fromBackorder`. Replaces the backorder list in one go (plain copies), so
// the save is a single clean update.
const takeOffBackorders = (order, lines) => {
  const next = (order.backorders || []).map((b) =>
    typeof b.toObject === "function" ? b.toObject() : { ...b },
  );
  for (const line of lines) {
    let left = line.quantity;
    const waiting = next
      .filter((b) => b.lineKey === line.lineKey && b.status === BACKORDER_STATUSES.AWAITING)
      .sort((a, b) => b.generation - a.generation);
    for (const b of waiting) {
      if (!left) break;
      const take = Math.min(left, b.quantity);
      b.quantity -= take;
      left -= take;
    }
    line.fromBackorder = line.quantity - left;
  }
  if (lines.some((l) => l.fromBackorder > 0)) {
    const kept = next.filter((b) => b.quantity > 0);
    order.backorders = kept.length ? kept : undefined;
  }
};

//------------------------------------------------ Refund ------------------------------------------
// POST /admin/orders/:id/refunds
//   { amount, reason, lines?: [{ lineKey, quantity }], restock?: true }
// `amount` is what is refunded (dollars). `lines` records which items it is for.

export const createOrderRefund = async (req, res) => {
  const { id } = req.params;
  let locked = false;
  try {
    // takeOffBackorder: the refunded units are the backordered ones (they
    // aren't coming). false = they are units that already shipped.
    const { lines = [], reason, restock = true, takeOffBackorder = true } = req.body || {};
    const amount = Number(req.body?.amount);
    const cleanReason = typeof reason === "string" ? reason.trim().slice(0, 300) : "";

    if (!Array.isArray(lines)) {
      return bad(res, "Invalid items", "Send the items as a list.");
    }
    if (!(amount > 0) || !isCents(amount)) {
      return bad(res, "Invalid amount", "Enter an amount above $0.00, in dollars and cents.");
    }
    if (!cleanReason) {
      return bad(res, "Reason is required", "Say why this is being refunded. The customer sees it.");
    }

    // One refund at a time per order (a second click, or two people at once).
    const now = new Date();
    const order = await Order.findOneAndUpdate(
      {
        _id: id,
        "cancellation.isLocked": { $ne: true },
        $or: [
          { refundLockUntil: { $exists: false } },
          { refundLockUntil: null },
          { refundLockUntil: { $lt: now } },
        ],
      },
      { $set: { refundLockUntil: new Date(now.getTime() + LOCK_MS) } },
      { new: true },
    );
    if (!order) {
      if (!(await Order.exists({ _id: id }))) return notFound(res);
      return bad(
        res,
        "Refund already in progress",
        "Another refund or a cancellation is being processed for this order. Wait a moment and reload.",
        409,
      );
    }
    locked = true;

    if (!REFUNDABLE.includes(order.status)) {
      return bad(
        res,
        "Order can't be refunded",
        order.status === ORDER_STATUSES.CANCELLED
          ? "This order was cancelled and already refunded."
          : "Only paid orders can be refunded.",
      );
    }
    if (!(order.payment?.transactionId || order.payment?.stripePaymentIntentId)) {
      return bad(
        res,
        "No payment to refund",
        "This order has no card payment on record. Refund it from the payment provider's dashboard.",
      );
    }

    // Items: whole numbers, no more than ordered minus already refunded.
    const orderLines = new Map(getOrderLines(order).map((l) => [l.key, l]));
    const refunded = refundedQuantityByKey(order);
    // Refunding units that already shipped (not the backordered ones): only
    // the units not on backorder can be meant.
    const waiting = takeOffBackorder === false ? awaitingQuantityByKey(order) : {};
    const picked = new Map();
    for (const line of lines) {
      const quantity = Number(line?.quantity);
      const orderLine = orderLines.get(line?.lineKey);
      if (!orderLine) {
        return bad(res, "Unknown item", "One of the items is not on this order. Reload the order and try again.");
      }
      const max = Math.max(
        0,
        orderLine.quantity - (refunded[orderLine.key] || 0) - (waiting[orderLine.key] || 0),
      );
      if (!isWholeNumber(quantity) || quantity > max) {
        return bad(res, "Invalid quantity", `${orderLine.name}: refund a whole number from 0 to ${max}.`);
      }
      if (picked.has(orderLine.key)) {
        return bad(res, "Duplicate item", `${orderLine.name} is listed twice.`);
      }
      if (quantity > 0) picked.set(orderLine.key, { orderLine, quantity });
    }

    // Amount: never more than what's left of the payment. Before the order
    // ships, refunding everything is a cancellation (it also handles the stock
    // and any consolidated shipment), so that's done with Cancel instead.
    // An order that paid a group shipment's fee keeps that fee while other
    // orders in the parcel still need it (same rule as cancelling).
    const cancelCap = await getCancellationRefundAmount(order);
    const refundable = round2(
      Math.max(0, (cancelCap ?? order.payment.totalAmount) - getRefundedTotal(order)),
    );
    if (amount > refundable + 0.0001) {
      return bad(
        res,
        "Amount too high",
        `At most ${fmt(refundable)} can still be refunded on this order.`,
      );
    }
    if (NOT_SHIPPED_YET.includes(order.status) && amount >= refundable - 0.0001) {
      return bad(
        res,
        "Cancel the order instead",
        "This would refund the whole order before it ships. Cancel the order instead: that refunds it and puts the items back in stock.",
      );
    }

    // Save the refund as pending first, so it is on record before any money moves.
    order.refunds = order.refunds || [];
    order.refunds.push({
      amount: round2(amount),
      reason: cleanReason,
      lines: picked.size
        ? [...picked.values()].map(({ orderLine, quantity }) => ({
            lineKey: orderLine.key,
            name: orderLine.group ? `${orderLine.name} (${orderLine.group})` : orderLine.name,
            quantity,
          }))
        : undefined,
      status: REFUND_ENTRY_STATUSES.PENDING,
      source: "admin",
      createdById: req.user._id,
    });
    const entry = order.refunds[order.refunds.length - 1];
    await order.save();

    let refund;
    try {
      refund = await getOrderGateway(order).createRefund(order, {
        amount: entry.amount,
        // One key per refund (Square allows at most 45 characters).
        idempotencyKey: `rf_${entry._id}`,
        reason: cleanReason,
      });
    } catch (gatewayErr) {
      console.error(`Refund failed for order ${order._id}:`, gatewayErr.message);
      entry.status = REFUND_ENTRY_STATUSES.FAILED;
      entry.error = String(gatewayErr.message || "Refused by the payment provider").slice(0, 300);
      order.refundLockUntil = undefined;
      await order.save();
      locked = false;
      return res.status(502).json({
        success: false,
        message: "Refund could not be processed",
        description: `The payment provider refused it: ${entry.error}. No money was refunded.`,
        order: refundView(order),
      });
    }

    let afterFailed = false;
    entry.gatewayRefundId = refund.id;
    if (refund.failed) {
      entry.status = REFUND_ENTRY_STATUSES.FAILED;
      entry.error = "The payment provider reported this refund as failed.";
    } else if (refund.completed) {
      entry.status = REFUND_ENTRY_STATUSES.COMPLETED;
      entry.completedAt = new Date();
    }
    // Money has moved: record that on its own first, so nothing after this
    // can lose it.
    await order.save();

    if (!refund.failed && entry.lines?.length) {
      try {
        // Backordered items aren't coming: take them off the backorder.
        if (takeOffBackorder !== false) takeOffBackorders(order, entry.lines);
        else for (const line of entry.lines) line.fromBackorder = 0;
        for (const line of entry.lines) {
          const tracked = await getLineStockTarget(order, line.lineKey);
          line.restockQuantity = tracked ? line.quantity - line.fromBackorder : 0;
        }
        const toRestock = entry.lines.filter((l) => l.restockQuantity > 0);
        if (!toRestock.length) {
          entry.restock = RESTOCK_STATUSES.NONE;
        } else if (restock === false) {
          entry.restock = RESTOCK_STATUSES.HELD;
        } else {
          // Marked done before adding, so a failure part-way never adds twice.
          entry.restock = RESTOCK_STATUSES.DONE;
          entry.restockedAt = new Date();
          entry.restockedById = req.user._id;
          await order.save();
          await restockOrderLines(
            order,
            toRestock.map((l) => ({ lineKey: l.lineKey, quantity: l.restockQuantity })),
          );
        }
        await order.save();
      } catch (afterErr) {
        afterFailed = true;
        console.error(
          `Refund ${entry.gatewayRefundId} for order ${order._id} went through, but updating the backorder/stock failed:`,
          afterErr.message,
        );
      }
    }

    if (!afterFailed) {
      order.refundLockUntil = undefined;
      await order.save();
      locked = false;
    }

    if (!refund.failed) sendRefundIssuedEmail(order, entry).catch(() => {});

    return res.status(refund.failed ? 502 : 200).json({
      success: !refund.failed,
      message: refund.failed ? "Refund failed" : `Refunded ${fmt(entry.amount)}`,
      description: refund.failed
        ? "The payment provider reported this refund as failed. No money was refunded."
        : afterFailed
          ? "The refund went through and the customer was emailed, but the backorder/stock couldn't be updated. Please check them by hand."
          : entry.restock === RESTOCK_STATUSES.DONE
          ? "The items were put back in stock and the customer was emailed."
          : entry.restock === RESTOCK_STATUSES.HELD
            ? "The customer was emailed. Put the items back in stock from the order when they're back."
            : "The customer was emailed.",
      order: refundView(order),
    });
  } catch (error) {
    return serverError(res, "Refund order", error);
  } finally {
    if (locked) {
      await Order.updateOne({ _id: id }, { $unset: { refundLockUntil: 1 } }).catch(() => {});
    }
  }
};

//------------------------------------------------ Put Back In Stock ------------------------------------------
// POST /admin/orders/:id/refunds/:refundId/restock
// For a refund whose items were held back from stock: puts them back now.

export const restockOrderRefund = async (req, res) => {
  try {
    const { id, refundId } = req.params;
    // Flip it to "done" first (only if still "held"), so it can't be restocked twice.
    const order = await Order.findOneAndUpdate(
      {
        _id: id,
        refunds: { $elemMatch: { _id: refundId, restock: RESTOCK_STATUSES.HELD } },
      },
      {
        $set: {
          "refunds.$.restock": RESTOCK_STATUSES.DONE,
          "refunds.$.restockedAt": new Date(),
          "refunds.$.restockedById": req.user._id,
        },
      },
      { new: true },
    );
    if (!order) {
      const exists = await Order.findOne({ _id: id, "refunds._id": refundId }, { _id: 1 });
      if (!exists) return notFound(res);
      return bad(res, "Nothing to put back", "These items were already put back in stock.");
    }

    const entry = order.refunds.find((r) => String(r._id) === String(refundId));
    try {
      await restockOrderLines(
        order,
        (entry.lines || [])
          .filter((l) => l.restockQuantity > 0)
          .map((l) => ({ lineKey: l.lineKey, quantity: l.restockQuantity })),
      );
    } catch (stockErr) {
      // Left as "done" so nothing is ever added twice; staff check the counts.
      console.error(`Put back in stock failed for order ${id}, refund ${refundId}:`, stockErr.message);
      return res.status(500).json({
        success: false,
        message: "Put back in stock failed part-way",
        description: "Some items may not have been added back. Please check their stock counts and fix them by hand.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Put back in stock",
      description: "The refunded items were added back to the website's stock.",
      order: refundView(order),
    });
  } catch (error) {
    return serverError(res, "Put back in stock", error);
  }
};
