import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDatabase from "./config/dbConnect.js";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if ((process.env.NODE_ENV || "").toLowerCase() !== "production") {
  dotenv.config({ path: "./config/config.env", quiet: true });
}

const validateEnv = () => {
  const requiredVars = [
    "JWT_ACCESS_TOKEN_SECRET",
    "JWT_REFRESH_TOKEN_SECRET",
    "FRONTEND_URL",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_PASSWORD",
    "SMTP_FROM_EMAIL",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "STRIPE_SECRET_KEY",
  ];

  const missing = requiredVars.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(
      "Missing required environment variables:",
      missing.join(", "),
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
          `Invalid numeric value for ${name}: "${value}". It must be a positive number.`,
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
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: [
          "'self'",
          "data:",
          "https://res.cloudinary.com",
          "https://*.cloudinary.com",
        ],
        mediaSrc: [
          "'self'",
          "https://res.cloudinary.com",
          "https://*.cloudinary.com",
        ],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: [
          "'self'",
          "https://res.cloudinary.com",
          "https://*.cloudinary.com",
          "https://api.stripe.com",
        ],
      },
    },
  }),
);

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(cookieParser());

// Payment routes mounted before express.json - webhook needs raw body, router handles it
app.use("/api/v1/payment", paymentRoutes);

app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ limit: "500mb", extended: true }));

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/public", publicRoutes);

// Serve static files from React app in production
if ((process.env.NODE_ENV || "").toLowerCase() === "production") {
  const frontendDistPath = path.join(__dirname, "../frontend/dist");

  app.use(express.static(frontendDistPath));

  app.use((req, res, next) => {
    // Skip API routes
    if (req.path.startsWith("/api")) {
      return next();
    }
    // Serve index.html for all other routes (SPA routing)
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
} else {
  // 404 handler for development (API routes only)
  app.use((_req, res) => {
    res.status(404).json({ message: "Route not found" });
  });
}

// Start server after DB connects
const PORT = process.env.PORT || 4000;
connectDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(
      `Backend running on port ${PORT} in ${process.env.NODE_ENV} mode`,
    );
  });
});
