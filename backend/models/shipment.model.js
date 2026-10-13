import mongoose from "mongoose";
import {
  PAYMENT_GATEWAYS,
  REFUND_STATUSES,
  SHIPMENT_STATUSES,
  SHIPMENT_PAYMENT_SOURCES,
} from "../constants/orderConstants.js";

/**
 * Shipment Schema (Pay Now, Ship Later)
 * Groups a customer's held orders — retail, dealer or wholesale — into one
 * parcel with one flat shipping fee and one tracking number. Only consolidated
 * shipments get a record; an order shipped on its own keeps using its own
 * `shipping` fields as before.
 *
 * `payment` mirrors the Order payment field names so the gateway adapters can
 * refund a shipment exactly the way they refund an order.
 */
const addressSchema = new mongoose.Schema(
  {
    name: { type: String },
    line1: { type: String },
    line2: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String },
    phone: { type: String },
  },
  { _id: false },
);

const shipmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: { type: String, trim: true },
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
    status: {
      type: String,
      enum: Object.values(SHIPMENT_STATUSES),
      default: SHIPMENT_STATUSES.PAID,
    },
    shippingCountry: { type: String },
    paymentSource: {
      type: String,
      enum: Object.values(SHIPMENT_PAYMENT_SOURCES),
      required: true,
    },
    // The new order whose checkout paid this shipment's fee ("order" source).
    carrierOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    payment: {
      gateway: {
        type: String,
        enum: Object.values(PAYMENT_GATEWAYS),
        default: PAYMENT_GATEWAYS.STRIPE,
      },
      shippingFee: { type: Number, default: 0, min: 0 },
      // Optional 0.5% insurance on the items of every order in the parcel.
      shippingInsurance: { type: Number, default: 0, min: 0 },
      taxAmount: { type: Number, default: 0, min: 0 },
      totalAmount: { type: Number, default: 0, min: 0 },
      // Standalone shipments only — an "order"-source shipment is looked up
      // through its carrier order instead.
      checkoutSessionId: { type: String },
      gatewayOrderId: { type: String },
      transactionId: { type: String },
      receiptNumber: { type: String },
      receiptUrl: { type: String },
      paidAt: { type: Date },
    },
    shipping: {
      address: { type: addressSchema, default: undefined },
      carrier: { type: String },
      trackingNumber: { type: String },
      trackingLink: { type: String },
      shippedAt: { type: Date },
    },
    // Set when the orders in the parcel weren't all addressed to the same
    // place — staff check with the customer before it goes out.
    reviewNote: { type: String },
    refund: {
      status: {
        type: String,
        enum: Object.values(REFUND_STATUSES),
        default: REFUND_STATUSES.NONE,
      },
      amount: { type: Number, min: 0 },
      gatewayRefundId: { type: String },
      initiatedAt: { type: Date },
      completedAt: { type: Date },
    },
  },
  { timestamps: true },
);

shipmentSchema.index({ status: 1, createdAt: 1 });
shipmentSchema.index(
  { "payment.checkoutSessionId": 1 },
  { unique: true, sparse: true },
);
shipmentSchema.index({ "payment.gatewayOrderId": 1 }, { sparse: true });
shipmentSchema.index({ "refund.gatewayRefundId": 1 }, { sparse: true });

const Shipment = mongoose.model("Shipment", shipmentSchema);

export default Shipment;
