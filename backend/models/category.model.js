import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    categoryName: {
      type: String,
      required: [true, "Category name is required"],
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
categorySchema.index({ key: 1 });
categorySchema.index({ categoryName: 1 });

const Category = mongoose.model("Category", categorySchema);

export default Category;

