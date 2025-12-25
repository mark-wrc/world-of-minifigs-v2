import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema(
  {
    subCategoryName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
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
subCategorySchema.index(
  { categoryId: 1, subCategoryName: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 }, // case-insensitive
  }
);

// Fast sorting for getAllSubCategories
subCategorySchema.index({ createdAt: -1 });

const SubCategory = mongoose.model("SubCategory", subCategorySchema);

export default SubCategory;