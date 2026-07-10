import mongoose from "mongoose";

const dealerTorsoBagSchema = new mongoose.Schema(
  {
    bagName: {
      type: String,
      required: true,
      trim: true,
    },
    baseSize: {
      type: Number,
      required: true,
      enum: [100, 500],
      default: 100,
    },
    items: [
      {
        _id: false,
        // Reference to the torso in General Inventory (bulk-minifig-parts). The
        // image/name/color live on that inventory item — never copied here — so
        // reusing a torso across bags stores one Cloudinary asset, not many.
        inventoryItemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "GeneralInventory",
        },
        // Legacy embedded image for bags created before the inventory-reference
        // migration. New bags leave this empty and read the image from the
        // referenced inventory item. Kept optional for dual-read during migration.
        image: {
          publicId: { type: String },
          url: { type: String },
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],
    stock: {
      type: Number,
      default: 0,
      min: 0,
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

// Fast lookup for active bags filtered by base size
dealerTorsoBagSchema.index({ isActive: 1, baseSize: 1 });

// Case-insensitive name lookup
dealerTorsoBagSchema.index(
  { bagName: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
  },
);

const DealerTorsoBag = mongoose.model("DealerTorsoBag", dealerTorsoBagSchema);

export default DealerTorsoBag;
