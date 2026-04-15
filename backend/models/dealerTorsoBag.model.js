import mongoose from "mongoose";

const dealerTorsoBagSchema = new mongoose.Schema(
  {
    bagName: {
      type: String,
      required: true,
      trim: true,
    },
    targetBundleSize: {
      type: Number,
      required: true,
      default: 100,
    },
    items: [
      {
        _id: false,
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

// Fast lookup for active bags filtered by target bundle size
dealerTorsoBagSchema.index({ isActive: 1, targetBundleSize: 1 });

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
