import mongoose from "mongoose";
import {
  ORDER_STATUSES,
  REFUND_STATUSES,
} from "../constants/orderConstants.js";

/* ------------------------------------------- Product Schema --------------------------------------- */

const productItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    productName: { type: String, required: true },
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
            imageUrl: { type: String },
            colorName: { type: String },
            colorHex: { type: String },
            pricePerBag: { type: Number },
            totalPrice: { type: Number },
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
      enum: ["product", "dealer", "reward"],
      default: "product",
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUSES),
      default: ORDER_STATUSES.PAID,
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
      stripeSessionId: { type: String },
      stripePaymentIntentId: { type: String },
      stripeInvoiceNumber: { type: String },
      invoiceUrl: { type: String },
      paidAt: { type: Date },
    },
    refund: {
      status: {
        type: String,
        enum: Object.values(REFUND_STATUSES),
        default: REFUND_STATUSES.NONE,
      },
      amount: { type: Number, min: 0 },
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
      deliveredAt: { type: Date },
    },
    billing: {
      cardHolderName: { type: String },
      country: { type: String },
    },
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
orderSchema.index({ orderType: 1 });
orderSchema.index({ "refund.status": 1 });
orderSchema.index({ "payment.stripePaymentIntentId": 1 });
orderSchema.index({ "payment.stripeSessionId": 1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
