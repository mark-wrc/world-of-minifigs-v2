import mongoose from "mongoose";

const connectDatabase = async () => {
  const env = (process.env.NODE_ENV || "").toUpperCase();
  const DB_URI =
    env === "PRODUCTION" ? process.env.DB_URI_PROD : process.env.DB_URI_LOCAL;

  if (!DB_URI) {
    console.error("Database URI is not defined. Check your config.env values.");
    process.exit(1);
  }

  try {
    const con = await mongoose.connect(DB_URI);
    console.log(`MongoDB connected: ${con?.connection?.host}`);
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

export default connectDatabase;
