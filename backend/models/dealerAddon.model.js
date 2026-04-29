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

// Uniqueness for addon name
dealerAddonSchema.index(
  { addonName: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
  },
);

const DealerAddon = mongoose.model("DealerAddon", dealerAddonSchema);

export default DealerAddon;
