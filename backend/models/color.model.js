import mongoose from "mongoose";

const colorSchema = new mongoose.Schema(
  {
    colorName: {
      type: String,
      required: true,
      trim: true,
    },
    hexCode: {
      type: String,
      required: true,
      trim: true,
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
colorSchema.index(
  { colorName: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 }, // case-insensitive
  }
);

// Faster sorting for getAllColors
colorSchema.index({ createdAt: -1 });

const Color = mongoose.model("Color", colorSchema);

export default Color;

