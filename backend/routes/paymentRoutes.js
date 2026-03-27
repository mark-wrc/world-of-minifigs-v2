import express from "express";
import {
  stripeWebhook,
  createCheckoutSession,
  confirmOrder,
} from "../controllers/paymentController.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

router.post(
  "/create-checkout-session",
  express.json({ limit: "500mb" }),
  authenticate,
  createCheckoutSession,
);
router.get("/confirm-order", authenticate, confirmOrder);

export default router;
