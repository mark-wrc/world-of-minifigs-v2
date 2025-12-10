import mongoose from "mongoose";

const subCollectionSchema = new mongoose.Schema(
  {
    subCollectionName: {
      type: String,
      required: [true, "SubCollection name is required"],
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

    collection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Collection",
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
subCollectionSchema.index({ key: 1 });
subCollectionSchema.index({ subCollectionName: 1 });
subCollectionSchema.index({ collection: 1 });

const SubCollection = mongoose.model("SubCollection", subCollectionSchema);

export default SubCollection;

