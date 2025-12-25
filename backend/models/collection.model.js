import mongoose from "mongoose";

const collectionSchema = new mongoose.Schema(
  {
    collectionName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
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

    isFeatured: {
      type: Boolean,
      default: false,
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
  }
);

// Indexes

// Fast lookup + uniqueness guarantee
collectionSchema.index(
  { collectionName: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 }, // case-insensitive
  }
);

// Faster sorting for getAllCollections
collectionSchema.index({ createdAt: -1 });

collectionSchema.index({ isFeatured: 1, createdAt: -1 });

const Collection = mongoose.model("Collection", collectionSchema);

export default Collection;
