import mongoose from "mongoose";

const bundleSchema = new mongoose.Schema(
  {
    bundleName: {
      type: String,
      required: true,
      trim: true,
    },
    bundleType: {
      type: String,
      enum: ["dealer", "reward"],
      required: true,
      index: true,
    },
    minifigQuantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    unitPrice: {
      type: Number,
      min: [0, "Unit price cannot be negative"],
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, "Total price cannot be negative"],
    },
    // Dealer-only: the torso-bag size this bundle uses (100 or 500).
    // Multiplier = minifigQuantity / baseSize. Optional for reward bundles.
    baseSize: {
      type: Number,
      enum: [100, 500],
    },
    features: {
      type: [String],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// Indexes

// Fast lookup for active bundles of a specific type
bundleSchema.index({ bundleType: 1, isActive: 1 });

bundleSchema.index(
  { bundleType: 1, minifigQuantity: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
  },
);

bundleSchema.index({ createdAt: -1 });

const Bundle = mongoose.model("Bundle", bundleSchema);

export default Bundle;
