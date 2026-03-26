import express from "express";
import {
  register,
  login,
  logout,
  verifyEmail,
  refreshToken,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  getCurrentUser,
} from "../controllers/authController.js";
import { sendContactMessage } from "../controllers/contactFormController.js";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  syncCart,
} from "../controllers/cartController.js";
import {
  authenticate,
  authorizeAdminOrDealer,
} from "../middlewares/auth.middleware.js";
import {
  getDealerBundlesForUser,
  getDealerAddonsForUser,
  getDealerExtraBagsForUser,
  getDealerTorsoBagsForUser,
} from "../controllers/dealerController.js";
import {
  getOrderConfig,
  getUserOrders,
  getUserOrderById,
  cancelOrder,
} from "../controllers/orderController.js";

const router = express.Router();

// Authentication & Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/verify-email", verifyEmail);
router.post("/refresh-token", refreshToken);
router.post("/resend-verification", resendVerification);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/contact", sendContactMessage);

// Private Account/User routes (Authenticated)
router.get("/me", authenticate, getCurrentUser);
router.put("/change-password", authenticate, changePassword);

// Cart routes
router
  .route("/cart")
  .get(authenticate, getCart)
  .post(authenticate, addToCart)
  .delete(authenticate, clearCart);

router.post("/cart/sync", authenticate, syncCart);

router
  .route("/cart/item")
  .put(authenticate, updateCartItem)
  .delete(authenticate, removeCartItem);

// Order routes (Authenticated)
router.get("/orders/config", authenticate, getOrderConfig);
router.get("/orders", authenticate, getUserOrders);
router.get("/orders/:id", authenticate, getUserOrderById);
router.post("/orders/:id/cancel", authenticate, cancelOrder);

// Dealer routes (Requires Dealer or Admin role)
router.get(
  "/dealer/bundles",
  authenticate,
  authorizeAdminOrDealer,
  getDealerBundlesForUser,
);
router.get(
  "/dealer/addons",
  authenticate,
  authorizeAdminOrDealer,
  getDealerAddonsForUser,
);
router.get(
  "/dealer/extra-bags",
  authenticate,
  authorizeAdminOrDealer,
  getDealerExtraBagsForUser,
);
router.get(
  "/dealer/torso-bags",
  authenticate,
  authorizeAdminOrDealer,
  getDealerTorsoBagsForUser,
);

export default router;
