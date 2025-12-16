import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDatabase from "./config/dbConnect.js";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
if ((process.env.NODE_ENV || "").toLowerCase() !== "production") {
  dotenv.config({ path: "./config/config.env" });
}

const validateEnv = () => {
  const requiredVars = [
    "JWT_ACCESS_TOKEN_SECRET",
    "JWT_REFRESH_TOKEN_SECRET",
    "FRONTEND_URL",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM_EMAIL",
  ];

  const missing = requiredVars.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(
      "Missing required environment variables:",
      missing.join(", ")
    );
    process.exit(1);
  }

  // Optional numeric validations – only if set
  const numericEnv = [
    "JWT_ACCESS_TOKEN_EXPIRY",
    "JWT_REFRESH_TOKEN_EXPIRY",
    "SMTP_PORT",
  ];

  numericEnv.forEach((name) => {
    const value = process.env[name];
    if (value !== undefined) {
      const num = Number.parseInt(value, 10);
      if (!Number.isFinite(num) || num <= 0) {
        console.error(
          `Invalid numeric value for ${name}: "${value}". It must be a positive number.`
        );
        process.exit(1);
      }
    }
  });
};

validateEnv();

const app = express();

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

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

// Rate limiting
const authRateLimitWindowMinutes =
  Number(process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES) || 15;
const authRateLimitMaxRequests =
  Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 20;

const authLimiter = rateLimit({
  windowMs: authRateLimitWindowMinutes * 60 * 1000,
  max: authRateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const windowSeconds = authRateLimitWindowMinutes * 60;

    res.status(429).json({
      success: false,
      message: "Too many requests",
      description:
        "You have made too many requests in a short period. Please wait a moment and try again.",
      windowSeconds,
      maxRequests: authRateLimitMaxRequests,
    });
  },
});

// Routes
app.use("/api/v1/auth", authLimiter, authRoutes);
app.use("/api/v1/user", userRoutes);
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
