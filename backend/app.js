import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDatabase from "./config/dbConnect.js";
import authRoutes from "./routes/authRoutes.js";

if ((process.env.NODE_ENV || "").toLowerCase() !== "production") {
  dotenv.config({ path: "./config/config.env" });
}

const app = express();

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Routes
app.use("/api/v1/auth", authRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Start server after DB connects
const PORT = process.env.PORT || 4000;
connectDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(
      `Backend running on port ${PORT} in ${process.env.NODE_ENV} mode`
    );
  });
});
