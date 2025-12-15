import express from "express";
import {
  register,
  login,
  logout,
  verifyEmail,
  refreshToken,
  resendVerification,
} from "../controllers/authController.js";

const router = express.Router();

// Authentication routes
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/verify-email", verifyEmail);
router.post("/refresh-token", refreshToken);
router.post("/resend-verification", resendVerification);

export default router;

