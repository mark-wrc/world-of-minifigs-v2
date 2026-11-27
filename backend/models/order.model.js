import mongoose from "mongoose";
import {
  BACKORDER_STATUSES,
  REFUND_ENTRY_STATUSES,
  RESTOCK_STATUSES,
} from "../../shared/orderLines.js";
import {
  ORDER_STATUSES,
  REFUND_STATUSES,
  DELIVERY_METHODS,
  PAYMENT_GATEWAYS,
} from "../constants/orderConstants.js";

/* ------------------------------------------- Product Schema --------------------------------------- */

const productItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    productName: { type: String, required: true },
    colorName: { type: String },
    variantIndex: { type: Number },
    quantity: { type: Number, required: true, min: 1 },
    basePrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    imageUrl: { type: String },
  },
  { _id: false },
);

/* ----------------------------------------- Dealer Schema ------------------------------------------ */

// A torso bag entry as it belongs to a single ordered bundle.
const dealerBundleTorsoSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "DealerTorsoBag" },
    name: { type: String },
    quantity: { type: Number },
  },
  { _id: false },
);

// A single ordered bundle. Dealers can order several distinct bundles
// (e.g. 1000 + 200) in one order, each with its own copy quantity (1-4)
// and its own torso-bag split.
const dealerBundleSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "Bundle" },
    name: { type: String },
    price: { type: Number },
    quantity: { type: Number, default: 1 },
    torsoBags: { type: [dealerBundleTorsoSchema], default: [] },
  },
  { _id: false },
);

const dealerItemSchema = new mongoose.Schema(
  {
    // Multi-bundle orders. Legacy single-bundle fields below are kept so
    // historical orders still render.
    bundles: {
      type: [dealerBundleSchema],
      default: undefined,
    },
    // --- Legacy (single-bundle orders placed before multi-bundle support) ---
    bundle: {
      type: new mongoose.Schema(
        {
          id: { type: mongoose.Schema.Types.ObjectId, ref: "Bundle" },
          name: { type: String },
          price: { type: Number },
        },
        { _id: false },
      ),
      default: undefined,
    },
    torsoBags: [
      {
        _id: false,
        id: { type: mongoose.Schema.Types.ObjectId, ref: "DealerTorsoBag" },
        name: { type: String },
        quantity: { type: Number },
      },
    ],
    addons: [
      {
        _id: false,
        id: { type: mongoose.Schema.Types.ObjectId, ref: "DealerAddon" },
        name: { type: String },
        type: { type: String },
        // Number of copies ordered (upgrade add-ons only; bundles are always 1).
        quantity: { type: Number, default: 1 },
        totalPrice: { type: Number },
        subItems: [
          {
            _id: false,
            invId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "GeneralInventory",
            },
            name: { type: String },
            qty: { type: Number },
            piecesPerBag: { type: Number },
            category: { type: String },
            imageUrl: { type: String },
            colorName: { type: String },
            colorHex: { type: String },
            bin: { type: String },
            pricePerBag: { type: Number },
            totalPrice: { type: Number },
            // Flash-sale provenance captured at purchase (null when not on sale).
            // pricePerBag holds the discounted price actually charged; these show
            // what it was and which sale applied, for the admin order view.
            originalPricePerBag: { type: Number, default: null },
            flashSaleName: { type: String, default: null },
          },
        ],
      },
    ],
    extraBags: [
      {
        _id: false,
        id: { type: mongoose.Schema.Types.ObjectId, ref: "DealerExtraBag" },
        name: { type: String },
        quantity: { type: Number },
        price: { type: Number },
        totalPrice: { type: Number },
      },
    ],
  },
  { _id: false },
);

/* ---------------------------------------- Backorder Schema ---------------------------------------- */

// Part of an order held back because it's out of stock. The rest of the order
// ships as usual (Shipment 1, the order's own status and tracking); these lines
// ship later as Shipment 2, 3, … with their own tracking. `lineKey` points at
// the order line (see shared/orderLines.js); `quantity` is how many of it.
const backorderLineSchema = new mongoose.Schema(
  {
    lineKey: { type: String, required: true },
    name: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    generation: { type: Number, required: true, min: 2 },
    status: {
      type: String,
      enum: Object.values(BACKORDER_STATUSES),
      default: BACKORDER_STATUSES.AWAITING,
    },
    // Staff note, e.g. "waiting on supplier" (admin only).
    note: { type: String },
    createdAt: { type: Date, default: Date.now },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    shipping: {
      carrier: { type: String },
      trackingNumber: { type: String },
      trackingLink: { type: String },
      shippedAt: { type: Date },
    },
    shippedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true },
);

/* ----------------------------------------- Refund Schema ------------------------------------------ */

// A refund made from the admin order view without cancelling the order (items
// and/or an amount), or one made straight in the Stripe/Square dashboard. An
// order can have several. The refund made when an order is cancelled stays in
// `order.refund` as before.
const refundLineSchema = new mongoose.Schema(
  {
    lineKey: { type: String, required: true },
    name: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    // Of `quantity`, how many were still backordered (never came in, so never put back in stock).
    fromBackorder: { type: Number, default: 0, min: 0 },
    // How many go back into the website's stock (0 when the website keeps no stock for it).
    restockQuantity: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const refundEntrySchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String },
    lines: { type: [refundLineSchema], default: undefined },
    status: {
      type: String,
      enum: Object.values(REFUND_ENTRY_STATUSES),
      default: REFUND_ENTRY_STATUSES.PENDING,
    },
    // "admin" = made from the order view (or by Odoo, as the Odoo admin account); "gateway" = made in the Stripe/Square dashboard.
    source: { type: String, enum: ["admin", "gateway"], default: "admin" },
    // Refunds sent by Odoo: Odoo's own id for the refund: asking again with the same id never refunds twice.
    requestId: { type: String },
    gatewayRefundId: { type: String },
    error: { type: String }, // why the gateway refused it (admin only)
    restock: {
      type: String,
      enum: Object.values(RESTOCK_STATUSES),
      default: RESTOCK_STATUSES.NONE,
    },
    restockedAt: { type: Date },
    restockedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    completedAt: { type: Date },
  },
  { _id: true },
);

/* ----------------------------------------- Order Schema ------------------------------------------- */

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: { type: String, trim: true },
    orderType: {
      type: String,
      enum: ["product", "dealer", "wholesale", "reward"],
      default: "product",
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUSES),
      default: ORDER_STATUSES.PAID,
    },
    // Set once the order joins a consolidated shipment (Pay Now, Ship Later):
    // a held order whose shipping was paid, or the new order that paid it.
    shipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shipment",
    },
    productItems: {
      type: [productItemSchema],
      default: undefined,
    },
    dealerItems: {
      type: dealerItemSchema,
      default: undefined,
    },
    payment: {
      subtotal: { type: Number, required: true, min: 0 },
      shippingFee: { type: Number, default: 0, min: 0 },
      shippingInsurance: { type: Number, default: 0, min: 0 },
      taxAmount: { type: Number, default: 0, min: 0 },
      discount: {
        type: new mongoose.Schema(
          {
            amount: { type: Number, min: 0 },
            couponId: { type: String },
            couponName: { type: String },
            promotionCode: { type: String },
            promotionCodeId: { type: String },
            percentOff: { type: Number, min: 0, max: 100 },
            amountOff: { type: Number, min: 0 },
          },
          { _id: false },
        ),
        default: undefined,
      },
      totalAmount: { type: Number, required: true, min: 0 },
      // Orders from before Square support have none stored and read as Stripe.
      gateway: {
        type: String,
        enum: Object.values(PAYMENT_GATEWAYS),
        default: PAYMENT_GATEWAYS.STRIPE,
      },
      // Gateway-neutral references, written for every gateway. Stripe orders
      // also keep the stripe* fields below for older readers.
      checkoutSessionId: { type: String }, // Stripe session id / Square: our draft id
      gatewayOrderId: { type: String }, // Square order id
      transactionId: { type: String }, // Stripe PaymentIntent id / Square payment id
      receiptNumber: { type: String }, // Stripe invoice number / Square receipt number
      receiptUrl: { type: String }, // Stripe hosted invoice / Square receipt
      stripeSessionId: { type: String },
      stripePaymentIntentId: { type: String },
      stripeInvoiceNumber: { type: String },
      invoiceUrl: { type: String },
      // Square can't lock the address country at checkout — set when the buyer
      // entered an address outside the destination they paid shipping for.
      shippingCountryMismatch: {
        type: new mongoose.Schema(
          {
            expected: { type: String },
            actual: { type: String },
          },
          { _id: false },
        ),
        default: undefined,
      },
      paidAt: { type: Date },
    },
    refund: {
      status: {
        type: String,
        enum: Object.values(REFUND_STATUSES),
        default: REFUND_STATUSES.NONE,
      },
      amount: { type: Number, min: 0 },
      gatewayRefundId: { type: String },
      stripeRefundId: { type: String },
      arn: { type: String }, // Acquirer Reference Number (admin-only)
      initiatedAt: { type: Date },
      completedAt: { type: Date },
    },
    shipping: {
      address: {
        name: { type: String },
        line1: { type: String },
        line2: { type: String },
        city: { type: String },
        state: { type: String },
        postalCode: { type: String },
        country: { type: String },
        phone: { type: String },
      },
      carrier: { type: String },
      trackingNumber: { type: String },
      trackingLink: { type: String },
      shippedAt: { type: Date },
    },
    // Set only when an order is handed over directly — hand delivery or an
    // in-store pick-up. Courier orders stop at "shipped" and leave this empty.
    delivery: {
      method: {
        type: String,
        enum: Object.values(DELIVERY_METHODS),
      },
      receivedBy: { type: String },
      notes: { type: String },
      deliveredAt: { type: Date },
      deliveredById: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
    billing: {
      cardHolderName: { type: String },
      country: { type: String },
    },
    // Lines held back to ship later (empty for almost every order).
    backorders: {
      type: [backorderLineSchema],
      default: undefined,
    },
    refunds: {
      type: [refundEntrySchema],
      default: undefined,
    },
    // Set while a refund from the order view is being sent to the gateway, so
    // two clicks can't refund twice. Expires on its own.
    refundLockUntil: { type: Date },
    cancellation: {
      reason: { type: String },
      notes: { type: String },
      cancelledAt: { type: Date },
      cancelledByRole: {
        type: String,
        enum: ["user", "admin"],
      },
      cancelledById: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      isLocked: { type: Boolean, default: false },
      lockExpiresAt: { type: Date },
    },
  },
  { timestamps: true },
);

/* ------------------------------------------- Indexes --------------------------------------------- */

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ userId: 1, status: 1 });
orderSchema.index({ shipmentId: 1 }, { sparse: true });
orderSchema.index({ orderType: 1 });
orderSchema.index({ "refund.status": 1 });
orderSchema.index({ "backorders.status": 1 }, { sparse: true });
orderSchema.index({ "refunds.gatewayRefundId": 1 }, { sparse: true });
orderSchema.index({ "payment.stripePaymentIntentId": 1 });
orderSchema.index({ "payment.stripeSessionId": 1 });
orderSchema.index({ "payment.checkoutSessionId": 1 });
orderSchema.index({ "payment.transactionId": 1 });
orderSchema.index({ "payment.gatewayOrderId": 1 }, { sparse: true });

const Order = mongoose.model("Order", orderSchema);

export default Order;
