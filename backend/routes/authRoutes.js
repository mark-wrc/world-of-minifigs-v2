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
  getCurrentUser,
} from "../controllers/authController.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Authentication routes
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/verify-email", verifyEmail);
router.post("/refresh-token", refreshToken);
router.post("/resend-verification", resendVerification);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", authenticate, getCurrentUser);

export default router;

