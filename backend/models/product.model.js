import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    key: {
      type: String,
      trim: true,
      unique: true,
    },
    partId: {
      type: String,
      required: [true, "Part ID is required"],
      trim: true,
      unique: true,
    },
    itemId: {
      type: String,
      required: [true, "Item ID is required"],
      trim: true,
      unique: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be a positive number"],
    },
    discount: {
      type: Number,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100%"],
    },
    discountPrice: {
      type: Number,
      min: [0, "Discount price must be a positive number"],
    },
    description1: {
      type: String,
      required: [true, "Product description 1 is required"],
      trim: true,
    },
    description2: {
      type: String,
      trim: true,
    },
    description3: {
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
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
    },
    collections: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Collection",
    },
    subCollections: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "SubCollection",
    },
    pieceCount: {
      type: Number,
      min: [0, "Piece count must be a positive number"],
    },
    productLength: {
      type: Number,
      min: [0, "Product length must be a positive number"],
    },
    width: {
      type: Number,
      min: [0, "Width must be a positive number"],
    },
    height: {
      type: Number,
      min: [0, "Height must be a positive number"],
    },
    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Color",
    },
    includes: {
      type: [String],
      default: [],
    },
    skillLevels: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "SkillLevel",
      default: [],
    },
    designer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Designer",
    },
    manufacturer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Manufacturer",
    },
    stocks: {
      type: Number,
      default: 0,
      min: [0, "Stocks cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    forPreOrder: {
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
productSchema.index({ partId: 1 });
productSchema.index({ itemId: 1 });
productSchema.index({ category: 1 });
productSchema.index({ subCategory: 1 });
productSchema.index({ manufacturer: 1 });
productSchema.index({ designer: 1 });
productSchema.index({ color: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isAvailable: 1 });
productSchema.index({ isActive: 1, isAvailable: 1 });
productSchema.index({ productName: 1 });
productSchema.index({ key: 1 });
productSchema.index({ price: 1 });
productSchema.index({ stocks: 1 });


const Product = mongoose.model("Product", productSchema);

export default Product;
