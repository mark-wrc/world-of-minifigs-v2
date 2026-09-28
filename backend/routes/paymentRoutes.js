import express from "express";
import {
  stripeWebhook,
  squareWebhook,
  createCheckoutSession,
  confirmOrder,
  getPaymentConfig,
} from "../controllers/paymentController.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Stripe keeps the original path so the Stripe dashboard endpoint is unchanged.
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

// Square signs the raw body — it must not be parsed before verification.
router.post(
  "/square/webhook",
  express.raw({ type: "application/json" }),
  squareWebhook,
);

router.get("/config", getPaymentConfig);

router.post(
  "/create-checkout-session",
  express.json({ limit: "500mb" }),
  authenticate,
  createCheckoutSession,
);
router.get("/confirm-order", authenticate, confirmOrder);

export default router;
