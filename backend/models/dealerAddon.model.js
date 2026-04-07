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
          ref: "MinifigInventory",
        },
        quantityPerBag: {
          type: Number,
          min: [1, "Quantity must be at least 1"],
        },
        pricePerBag: {
          type: Number,
          default: 0,
        },
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
