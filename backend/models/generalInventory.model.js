import mongoose from "mongoose";

const INVENTORY_CATEGORIES = [
  "accessories",
  "animals",
  "minifigs",
  "printed-tiles",
];

const generalInventorySchema = new mongoose.Schema(
  {
    minifigName: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      enum: [...INVENTORY_CATEGORIES, null],
      default: null,
      index: true,
    },

    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Collection",
      default: null,
      index: true,
    },

    // Single source of truth: every inventory item is sold as a bag (or one minifig).
    pricePerBag: {
      type: Number,
      required: true,
      min: [0.01, "Price per bag must be at least 0.01"],
    },

    // Informational only — shown to customers as "X pcs/bag". Defaults to 1 (a single minifig).
    piecesPerBag: {
      type: Number,
      required: true,
      default: 1,
      min: [1, "Pieces per bag must be at least 1"],
    },

    // Stock is counted in BAGS. Decremented directly by selectedBags on checkout.
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },

    image: {
      publicId: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
    },

    colorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Color",
      required: true,
      index: true,
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

/* ----------------------------- Indexes ----------------------------- */

// Fast lookup + uniqueness for name and color combo
generalInventorySchema.index(
  { colorId: 1, minifigName: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 }, // Case-insensitive
  },
);

// Search optimization
generalInventorySchema.index({ minifigName: 1 });
generalInventorySchema.index({ isActive: 1 });
generalInventorySchema.index({ createdAt: -1 });

const GeneralInventory = mongoose.model(
  "GeneralInventory",
  generalInventorySchema,
);

export { INVENTORY_CATEGORIES };
export default GeneralInventory;
