import mongoose from "mongoose";

const dealerAddonSchema = new mongoose.Schema(
  {
    addonName: {
      type: String,
      required: true,
      trim: true,
    },
    addonType: {
      type: String,
      required: true,
      enum: ["bundle", "upgrade"],
    },
    // Per-order purchase policy for `upgrade` add-ons:
    //   single    → dealer can buy exactly 1 (current default behaviour)
    //   limited   → dealer can buy 1..maxQuantity
    //   unlimited → dealer can buy any quantity (hard-capped server-side)
    // `bundle` add-ons ignore this — their quantity is the per-item bag split.
    quantityMode: {
      type: String,
      enum: ["single", "limited", "unlimited"],
      default: "single",
    },
    // Only meaningful when quantityMode === "limited".
    maxQuantity: {
      type: Number,
      min: [1, "Max quantity must be at least 1"],
      default: null,
    },
    // Optional finite inventory for upgrade add-ons:
    //   null   → not tracked, sells without a stock limit
    //   number → depletes as dealers order, blocks once it hits 0
    stock: {
      type: Number,
      min: [0, "Stock cannot be negative"],
      default: null,
    },
    visibleChannels: {
      type: [String],
      enum: ["dealer", "wholesale"],
      default: ["dealer"],
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      min: [0, "Price cannot be negative"],
    },
    discount: {
      type: Number,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100"],
      default: null,
    },
    discountPrice: {
      type: Number,
      min: [0, "Discount price cannot be negative"],
      default: null,
    },
    badge: {
      type: String,
      trim: true,
      default: null,
    },
    bundleItems: [
      {
        _id: false,
        inventoryItemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "GeneralInventory",
        },
      },
    ],
    image: {
      publicId: { type: String },
      url: { type: String },
    },
    // Optional description shown in the `upgrade` preview modal. Falls back to
    // `description` on the client when left blank. Ignored for `bundle` types.
    previewDescription: {
      type: String,
      trim: true,
    },
    // Read-only preview gallery for `upgrade` add-ons — shows the dealer what
    // they receive once purchased. No quantity/customisation; display only.
    // Ignored for `bundle` add-ons (which preview their actual bundleItems).
    previewImages: [
      {
        _id: false,
        publicId: { type: String },
        url: { type: String },
        label: { type: String, trim: true },
      },
    ],
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

// Fast lookup by addon type
dealerAddonSchema.index({ addonType: 1 });

// Fast lookup for active dealer addons
dealerAddonSchema.index({ isActive: 1 });

// Sorting by latest
dealerAddonSchema.index({ createdAt: -1 });

dealerAddonSchema.index({ visibleChannels: 1, isActive: 1 });

// Uniqueness for addon name (shared across channels).
dealerAddonSchema.index(
  { addonName: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
  },
);

const DealerAddon = mongoose.model("DealerAddon", dealerAddonSchema);

export default DealerAddon;
