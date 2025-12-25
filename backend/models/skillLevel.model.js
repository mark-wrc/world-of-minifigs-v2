import mongoose from "mongoose";

const skillLevelSchema = new mongoose.Schema(
  {
    skillLevelName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
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
skillLevelSchema.index(
  { skillLevelName: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 }, // case-insensitive
  }
);

// Faster sorting for getAllSkillLevels
skillLevelSchema.index({ createdAt: -1 });

const SkillLevel = mongoose.model("SkillLevel", skillLevelSchema);

export default SkillLevel;
