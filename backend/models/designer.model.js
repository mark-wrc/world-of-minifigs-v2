import mongoose from "mongoose";

const designerSchema = new mongoose.Schema(
  {
    designerName: {
      type: String,
      required: [true, "Designer name is required"],
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
    socialLinks: {
      website: {
        type: String,
        trim: true,
      },
      instagram: {
        type: String,
        trim: true,
      },
      facebook: {
        type: String,
        trim: true,
      },
      twitter: {
        type: String,
        trim: true,
      },
      linkedin: {
        type: String,
        trim: true,
      },
      youtube: {
        type: String,
        trim: true,
      },
    },
    profilePicture: {
      publicId: {
        type: String,
      },
      url: {
        type: String,
      },
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
designerSchema.index({ designerName: 1 });
designerSchema.index({ key: 1 });

const Designer = mongoose.model("Designer", designerSchema);

export default Designer;

