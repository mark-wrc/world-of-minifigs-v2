import mongoose from "mongoose";

const collectionSchema = new mongoose.Schema(
  {
    collectionName: {
      type: String,
      required: [true, "Collection name is required"],
      trim: true,
    },
    key: {
      type: String,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    images: [
      {
        publicId: {
          type: String,
          required: [true, "Image public ID is required"],
        },
        url: {
          type: String,
          required: [true, "Image URL is required"],
        },
      },
    ],

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

// Index for better query performance
collectionSchema.index({ key: 1 });
collectionSchema.index({ collectionName: 1 });

const Collection = mongoose.model("Collection", collectionSchema);

export default Collection;
