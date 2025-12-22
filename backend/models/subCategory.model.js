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

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes

subCategorySchema.index(
  { category: 1, subCategoryName: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
  }
);

// Fast sorting for admin tables
subCategorySchema.index({ createdAt: -1 });

const SubCategory = mongoose.model("SubCategory", subCategorySchema);

export default SubCategory;