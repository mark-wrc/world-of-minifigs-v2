import mongoose from "mongoose";

const skillLevelSchema = new mongoose.Schema(
  {
    skillLevelName: {
      type: String,
      required: [true, "Skill level name is required"],
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
skillLevelSchema.index({ key: 1 });
skillLevelSchema.index({ skillLevelName: 1 });

const SkillLevel = mongoose.model("SkillLevel", skillLevelSchema);

export default SkillLevel;
