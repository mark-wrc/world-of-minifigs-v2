import mongoose from "mongoose";

/**
 * OrderDraft Schema
 * Acts as a temporary snapshot of an order's configuration before payment.
 * Solves Stripe's 500-character metadata limit by passing ID references.
 */
const orderDraftSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderType: {
      type: String,
      enum: ["product", "dealer", "wholesale", "reward"],
      required: true,
    },
    /**
     * Payload stores the specific configuration for the order type.
     * Dealer: { bundleId, torsoBagId, addons[], extraBags[] }
     * Product: { items: [{ productId, variantIndex, quantity }] }
     */
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // 24 hours - auto-cleanup if payment fails
    },
  },
  { timestamps: true },
);

const OrderDraft = mongoose.model("OrderDraft", orderDraftSchema);
export default OrderDraft;
