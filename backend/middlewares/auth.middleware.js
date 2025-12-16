import User from "../models/user.model.js";
import { verifyAccessToken } from "../utils/generateToken.js";

// Middleware to authenticate user using JWT access token
export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access token is required",
        description: "Please provide a valid access token in the Authorization header.",
      });
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token is required",
        description: "Please provide a valid access token in the Authorization header.",
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token",
        description: "Your session has expired or the token is invalid. Please sign in again.",
      });
    }

    // Find user
    const user = await User.findById(decoded.userId).select(
      "-password -refreshToken"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
        description: "The user associated with this token no longer exists. Please sign in again.",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
        description: "Your account has been deactivated. Please contact support for assistance.",
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication failed",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

// Middleware to check if user is verified
export const requireVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      description: "Please sign in to access this resource.",
    });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: "Please verify your email address to continue",
      description: "You need to verify your email address before accessing this resource.",
    });
  }

  next();
};

// Middleware to check user roles
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        description: "Please sign in to access this resource.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource",
        description: "Your account does not have the required permissions to access this resource.",
      });
    }

    next();
  };
};

// Optional authentication - attaches user if token is valid, but doesn't require it
// Useful for routes that work for both authenticated and unauthenticated users
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      try {
        const decoded = verifyAccessToken(token);
        const user = await User.findById(decoded.userId).select(
          "-password -refreshToken"
        );

        if (user && user.isActive) {
          req.user = user;
        }
      } catch (error) {
        // Token invalid, but continue without user
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
