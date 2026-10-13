import Order from "../models/order.model.js";
import Shipment from "../models/shipment.model.js";
import User from "../models/user.model.js";
import sendEmail from "../utils/sendEmail.js";
import {
  ORDER_STATUSES,
  REFUND_STATUSES,
  SHIPMENT_STATUSES,
  SHIPMENT_PAYMENT_SOURCES,
} from "../constants/orderConstants.js";
import { resolveShippingCountry } from "../../shared/shippingData.js";
import { getOrderGateway } from "./payment/gateways/index.js";
import {
  getAdminShipmentReadyTemplate,
  getShipmentShippedTemplate,
} from "../utils/Email/orderEmails.js";

// Pay Now, Ship Later: held orders are paid without shipping, then grouped
// into one Shipment — one parcel, one flat fee, one tracking number — when the
// customer asks to ship them. See PAY_NOW_SHIP_LATER.MD.

const round2 = (n) => Math.round(n * 100) / 100;

const appName = () => process.env.SMTP_FROM_NAME || "World of Minifigs";

const shipmentRef = (shipment) =>
  String(shipment._id).substring(0, 7).toUpperCase();

// ------------------------- Held Orders -------------------------

// Held orders not yet in a shipment, oldest first.
export const findHeldOrders = (userId) =>
  Order.find({
    userId,
    status: ORDER_STATUSES.ON_HOLD,
    shipmentId: null,
  }).sort({ createdAt: 1 });

// The one country every held order ships to. `mixed` when they disagree —
// rates differ by country, so mixed orders can't share a flat fee.
export const getHeldDestination = (orders) => {
  const codes = [
    ...new Set(
      orders
        .map((o) => o.shipping?.address?.country?.toUpperCase())
        .filter(Boolean),
    ),
  ];
  return { country: codes.length === 1 ? codes[0] : null, mixed: codes.length > 1 };
};

export const getHeldSummary = async (userId) => {
  const orders = await findHeldOrders(userId)
    .select(
      "orderType createdAt payment.subtotal payment.totalAmount payment.receiptNumber payment.stripeInvoiceNumber shipping.address.country",
    )
    .lean();

  const { country, mixed } = getHeldDestination(orders);
  const shippingRate = resolveShippingCountry(country).amount / 100;
  const count = orders.length;

  return {
    count,
    orders,
    country,
    mixedCountries: mixed,
    shippingRate,
    // Items of every held order — the base for the optional 0.5% insurance
    // charged when they ship.
    itemsSubtotal: round2(
      orders.reduce((sum, o) => sum + (o.payment?.subtotal || 0), 0),
    ),
    // What shipping each order on its own would have cost, less the one fee.
    shippingSaved: count > 1 ? round2((count - 1) * shippingRate) : 0,
  };
};

// ------------------------- Building a Shipment -------------------------

const addressKey = (address) =>
  [address.line1, address.line2, address.city, address.postalCode, address.country]
    .map((part) => (part || "").trim().toLowerCase())
    .join("|");

// Tax and the flat rate were worked out per order from its own address, so a
// parcel whose orders disagree on the address needs a human look first.
const findAddressMismatch = (shipment, orders) => {
  const addresses = [
    shipment.shipping?.address,
    ...orders.map((o) => o.shipping?.address),
  ].filter((a) => a?.line1);
  const distinct = new Set(addresses.map(addressKey));
  return distinct.size > 1
    ? "The orders in this shipment were paid with different shipping addresses. Confirm the address with the customer before shipping."
    : undefined;
};

// Moves the still-held orders into the shipment in one atomic update, so an
// order cancelled or shipped elsewhere in the meantime is simply left out.
const linkHeldOrders = async (shipment, orderIds) => {
  if (!orderIds?.length) return [];
  await Order.updateMany(
    {
      _id: { $in: orderIds },
      userId: shipment.userId,
      status: ORDER_STATUSES.ON_HOLD,
      shipmentId: null,
    },
    { $set: { status: ORDER_STATUSES.PAID, shipmentId: shipment._id } },
  );
  return Order.find({
    shipmentId: shipment._id,
    status: ORDER_STATUSES.PAID,
  });
};

const notifyAdminShipmentReady = (shipment, orders) => {
  const adminEmail = process.env.SMTP_FROM_EMAIL;
  if (!adminEmail) return;

  User.findById(shipment.userId, "firstName lastName email")
    .then((user) => {
      const customerName = user
        ? `${user.firstName} ${user.lastName}`.trim() || user.email
        : shipment.email;
      return sendEmail({
        email: adminEmail,
        subject: `Consolidated shipment ready to pack (${orders.length} orders) - ${appName()}`,
        message: getAdminShipmentReadyTemplate(shipment, orders, customerName),
      });
    })
    .catch((err) =>
      console.error("Admin shipment email failed:", err.message),
    );
};

const notifyAdminManualRefund = (shipment, reason) => {
  const adminEmail = process.env.SMTP_FROM_EMAIL;
  if (!adminEmail) return;

  sendEmail({
    email: adminEmail,
    subject: `Action needed - refund shipping for shipment ${shipmentRef(shipment)}`,
    message: `<p>${reason}</p>
<p>Shipment ID: ${shipment._id}<br>Paid with: ${shipment.payment.gateway}<br>Payment: ${shipment.payment.transactionId}<br>Amount: $${shipment.payment.totalAmount.toFixed(2)}</p>
<p>The automatic refund didn't go through. Please refund it from the ${shipment.payment.gateway} dashboard.</p>`,
  }).catch((err) =>
    console.error("Admin manual refund email failed:", err.message),
  );
};

// Returns the shipping payment of a shipment that has nothing left to ship.
// Never throws — a failed refund is flagged to the admin instead.
const refundShipment = async (shipment, reason) => {
  if (!shipment.payment?.transactionId || !(shipment.payment.totalAmount > 0)) {
    return;
  }

  try {
    const refund = await getOrderGateway(shipment).createRefund(shipment, {
      amount: shipment.payment.totalAmount,
    });
    shipment.refund = {
      status: refund.completed
        ? REFUND_STATUSES.COMPLETED
        : REFUND_STATUSES.PENDING,
      amount: refund.amount,
      gatewayRefundId: refund.id,
      initiatedAt: new Date(),
      ...(refund.completed && { completedAt: new Date() }),
    };
  } catch (err) {
    console.error(
      `Shipping refund failed for shipment ${shipment._id}:`,
      err.message,
    );
    notifyAdminManualRefund(shipment, reason);
  }
};

// Shipping-only checkout paid: pull in the held orders it was for. If every
// one of them was cancelled while the customer was paying, there's nothing to
// ship and the fee goes straight back.
export const fillStandaloneShipment = async (shipment, orderIds) => {
  const orders = await linkHeldOrders(shipment, orderIds);

  if (orders.length === 0) {
    shipment.status = SHIPMENT_STATUSES.CANCELLED;
    await refundShipment(
      shipment,
      `Shipment ${shipmentRef(shipment)} was paid for, but none of its held orders were still waiting to ship.`,
    );
    await shipment.save();
    return orders;
  }

  shipment.orders = orders.map((o) => o._id);
  shipment.reviewNote = findAddressMismatch(shipment, orders);
  await shipment.save();

  notifyAdminShipmentReady(shipment, orders);
  return orders;
};

// A new order checked out with "ship my held orders with this one": its own
// shipping fee — and its insurance, if taken, which was calculated on the
// whole parcel — covers everything. No-op when nothing is still held.
export const consolidateWithOrder = async (order, heldOrderIds) => {
  if (!heldOrderIds?.length || order.status !== ORDER_STATUSES.PAID) return;

  const shipment = new Shipment({
    userId: order.userId,
    email: order.email,
    status: SHIPMENT_STATUSES.PAID,
    shippingCountry: order.shipping?.address?.country,
    paymentSource: SHIPMENT_PAYMENT_SOURCES.ORDER,
    carrierOrderId: order._id,
    payment: {
      gateway: order.payment.gateway,
      shippingFee: order.payment.shippingFee,
      shippingInsurance: order.payment.shippingInsurance || 0,
      totalAmount: round2(
        order.payment.shippingFee + (order.payment.shippingInsurance || 0),
      ),
      transactionId: order.payment.transactionId,
      receiptNumber: order.payment.receiptNumber,
      receiptUrl: order.payment.receiptUrl,
      paidAt: order.payment.paidAt,
    },
    shipping: { address: order.shipping?.address },
  });

  const held = await linkHeldOrders(shipment, heldOrderIds);
  if (held.length === 0) return; // shipment never saved — order ships alone

  await Order.updateOne({ _id: order._id }, { shipmentId: shipment._id });
  order.shipmentId = shipment._id;

  const orders = [order, ...held];
  shipment.orders = orders.map((o) => o._id);
  shipment.reviewNote = findAddressMismatch(shipment, held);
  await shipment.save();

  notifyAdminShipmentReady(shipment, orders);
};

// ------------------------- Shipping -------------------------

// Marks the whole parcel shipped: every order still waiting in it gets the
// same carrier and tracking number, and the customer gets one email.
export const shipShipment = async (
  shipment,
  { carrier, trackingNumber, trackingLink },
) => {
  const shippedAt = new Date();

  await Order.updateMany(
    { shipmentId: shipment._id, status: ORDER_STATUSES.PAID },
    {
      $set: {
        status: ORDER_STATUSES.SHIPPED,
        "shipping.carrier": carrier,
        "shipping.trackingNumber": trackingNumber,
        "shipping.trackingLink": trackingLink,
        "shipping.shippedAt": shippedAt,
      },
    },
  );

  shipment.status = SHIPMENT_STATUSES.SHIPPED;
  shipment.shipping.carrier = carrier;
  shipment.shipping.trackingNumber = trackingNumber;
  shipment.shipping.trackingLink = trackingLink;
  shipment.shipping.shippedAt = shippedAt;
  await shipment.save();

  const orders = await Order.find({
    shipmentId: shipment._id,
    status: ORDER_STATUSES.SHIPPED,
  });

  const email = shipment.email || orders[0]?.email;
  if (email) {
    sendEmail({
      email,
      subject: `Your Orders Have Been Shipped – ${appName()}`,
      message: getShipmentShippedTemplate(shipment, orders),
    }).catch((err) =>
      console.error("Shipment shipped email failed:", err.message),
    );
  }

  return orders;
};

// ------------------------- Cancellation -------------------------

// How much to refund when an order is cancelled. Undefined means the full
// payment. The order that paid a shipment's flat fee (and parcel insurance)
// keeps both while other orders in the parcel still need them.
export const getCancellationRefundAmount = async (order) => {
  if (!order.shipmentId) return undefined;

  const shipment = await Shipment.findById(order.shipmentId);
  if (
    shipment?.status !== SHIPMENT_STATUSES.PAID ||
    shipment.paymentSource !== SHIPMENT_PAYMENT_SOURCES.ORDER ||
    !shipment.carrierOrderId?.equals(order._id)
  ) {
    return undefined;
  }

  const othersWaiting = await Order.exists({
    shipmentId: shipment._id,
    _id: { $ne: order._id },
    status: ORDER_STATUSES.PAID,
  });
  if (!othersWaiting) return undefined;

  return round2(
    Math.max(0, order.payment.totalAmount - shipment.payment.totalAmount),
  );
};

// After an order in a shipment is cancelled: once nothing in the parcel is
// left to ship, the shipment is cancelled and its shipping fee refunded
// (unless the order that paid it was already refunded in full).
export const releaseShipmentIfEmpty = async (order) => {
  if (!order.shipmentId) return;

  const shipment = await Shipment.findById(order.shipmentId);
  if (shipment?.status !== SHIPMENT_STATUSES.PAID) return;

  const stillToShip = await Order.exists({
    shipmentId: shipment._id,
    status: ORDER_STATUSES.PAID,
  });
  if (stillToShip) return;

  shipment.status = SHIPMENT_STATUSES.CANCELLED;

  let feeAlreadyRefunded = false;
  if (shipment.paymentSource === SHIPMENT_PAYMENT_SOURCES.ORDER) {
    const carrier = await Order.findById(shipment.carrierOrderId);
    feeAlreadyRefunded =
      carrier?.status === ORDER_STATUSES.CANCELLED &&
      (carrier.refund?.amount ?? 0) >= carrier.payment.totalAmount - 0.005;
  }

  if (!feeAlreadyRefunded) {
    await refundShipment(
      shipment,
      `Every order in shipment ${shipmentRef(shipment)} was cancelled before it shipped, so its shipping fee should be refunded.`,
    );
  }
  await shipment.save();
};

// ------------------------- Refund Webhook -------------------------

// Completes a shipping refund we started. Returns true when the refund
// belonged to a shipment, so the order refund handler can skip it.
export const applyShipmentRefund = async (refund) => {
  if (!refund.id) return false;
  const shipment = await Shipment.findOne({
    "refund.gatewayRefundId": refund.id,
  });
  if (!shipment) return false;

  if (refund.completed && shipment.refund.status !== REFUND_STATUSES.COMPLETED) {
    shipment.refund.status = REFUND_STATUSES.COMPLETED;
    shipment.refund.completedAt = new Date();
    shipment.refund.amount = refund.amount;
    await shipment.save();
  }
  return true;
};

// ------------------------- Lookups -------------------------

export const findShipmentByCheckoutRef = (ref) =>
  Shipment.findOne({ "payment.checkoutSessionId": ref });

// Brief view of a shipment's orders for the customer and admin pages.
export const SHIPMENT_ORDER_SUMMARY_FIELDS =
  "orderType status createdAt payment.totalAmount payment.receiptNumber payment.stripeInvoiceNumber";
