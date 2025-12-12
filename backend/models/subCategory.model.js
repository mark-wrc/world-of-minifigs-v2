import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema(
  {
    subCategoryName: {
      type: String,
      required: [true, "SubCategory name is required"],
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

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
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
subCategorySchema.index({ key: 1 });
subCategorySchema.index({ subCategoryName: 1 });
subCategorySchema.index({ category: 1 });

const SubCategory = mongoose.model("SubCategory", subCategorySchema);

export default SubCategory;

