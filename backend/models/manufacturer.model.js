import mongoose from "mongoose";

const manufacturerSchema = new mongoose.Schema(
  {
    manufacturerName: {
      type: String,
      required: [true, "Manufacturer name is required"],
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
    country: {
      type: String,
      trim: true,
    },
    website: {
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
manufacturerSchema.index({ manufacturerName: 1 });
manufacturerSchema.index({ key: 1 });
manufacturerSchema.index({ country: 1 });

const Manufacturer = mongoose.model("Manufacturer", manufacturerSchema);

export default Manufacturer;
