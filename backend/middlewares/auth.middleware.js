import User from "../models/user.model.js";
import {
  verifyAccessToken,
  verifyRefreshToken,
  generateTokens,
} from "../utils/generateToken.js";

// Middleware to authenticate user using JWT access token with automatic refresh
export const authenticate = async (req, res, next) => {
  try {
    // Try to get token from httpOnly cookie first, then fallback to Authorization header
    let token = req.cookies?.accessToken;

    // Fallback to Authorization header if cookie is not available
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token is required",
        description: "Please sign in to continue.",
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      // Token expired or invalid - try to refresh if refresh token exists
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired access token",
          description:
            "Your session has expired or the token is invalid. Please sign in again.",
        });
      }

      // Try to verify and use refresh token
      try {
        const refreshDecoded = verifyRefreshToken(refreshToken);

        // Find user with refresh token
        const userWithRefresh = await User.findById(refreshDecoded.userId);

        if (!userWithRefresh || !userWithRefresh.isActive) {
          return res.status(401).json({
            success: false,
            message: "User not found or inactive",
            description: "Your account is not available. Please sign in again.",
          });
        }

        // Verify refresh token matches stored token
        if (userWithRefresh.refreshToken !== refreshToken) {
          userWithRefresh.refreshToken = undefined;
          userWithRefresh.refreshTokenExpiry = undefined;
          await userWithRefresh.save();

          return res.status(401).json({
            success: false,
            message: "Invalid token",
            description: "Your session is invalid. Please sign in again.",
          });
        }

        // Check if refresh token has expired
        if (
          !userWithRefresh.refreshTokenExpiry ||
          userWithRefresh.refreshTokenExpiry < new Date()
        ) {
          // Clear expired refresh token from database
          userWithRefresh.refreshToken = undefined;
          userWithRefresh.refreshTokenExpiry = undefined;
          await userWithRefresh.save();

          // Clear cookies to log out user (with same options as when setting)
          res.clearCookie("accessToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
          });
          res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
          });

          return res.status(401).json({
            success: false,
            message: "Session expired",
            description: "Your session has expired. Please sign in again.",
          });
        }

        // Refresh token is valid - generate new tokens
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
          generateTokens(userWithRefresh._id);

        const refreshTokenDays =
          Number(process.env.JWT_REFRESH_TOKEN_EXPIRY) || 7;
        const accessTokenDays =
          Number(process.env.JWT_ACCESS_TOKEN_EXPIRY) || 1;
        const newRefreshTokenExpiry = new Date();
        newRefreshTokenExpiry.setDate(
          newRefreshTokenExpiry.getDate() + refreshTokenDays
        );

        userWithRefresh.refreshToken = newRefreshToken;
        userWithRefresh.refreshTokenExpiry = newRefreshTokenExpiry;
        await userWithRefresh.save();

        // Set new access token as httpOnly cookie
        res.cookie("accessToken", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: accessTokenDays * 24 * 60 * 60 * 1000,
        });

        // Update refresh token cookie
        res.cookie("refreshToken", newRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: refreshTokenDays * 24 * 60 * 60 * 1000,
        });

        // Use the new decoded token
        decoded = { userId: userWithRefresh._id };
        token = newAccessToken; // Update token for user lookup
      } catch (refreshError) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token",
          description: "Your session has expired. Please sign in again.",
        });
      }
    }

    // Find user (include refreshTokenExpiry to check expiry, exclude password and refreshToken value)
    const user = await User.findById(decoded.userId).select(
      "-password -refreshToken"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
        description:
          "The user associated with this token no longer exists. Please sign in again.",
      });
    }

    // Check if refresh token has expired (even if access token is still valid)
    // Fetch refreshTokenExpiry separately to check expiry
    const userForExpiryCheck = await User.findById(decoded.userId).select(
      "refreshToken refreshTokenExpiry"
    );

    // If refreshTokenExpiry exists and is expired, or if refreshToken exists but expiry is missing/expired
    if (userForExpiryCheck) {
      const isExpired =
        userForExpiryCheck.refreshTokenExpiry &&
        userForExpiryCheck.refreshTokenExpiry < new Date();

      if (isExpired) {
        // Refresh token expired - clear it and log out user
        userForExpiryCheck.refreshToken = undefined;
        userForExpiryCheck.refreshTokenExpiry = undefined;
        await userForExpiryCheck.save();

        // Clear cookies to log out user
        res.clearCookie("accessToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        });
        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        });

        return res.status(401).json({
          success: false,
          message: "Session expired",
          description: "Your session has expired. Please sign in again.",
        });
      }
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
        description:
          "Your account has been deactivated. Please contact support for assistance.",
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
      description:
        "You need to verify your email address before accessing this resource.",
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
        description:
          "Your account does not have the required permissions to access this resource.",
      });
    }

    next();
  };
};

//  authorize admin users only
export const authorizeAdmin = requireRole("admin");

// Optional authentication - attaches user if token is valid, but doesn't require it
// Useful for routes that work for both authenticated and unauthenticated users
export const optionalAuth = async (req, res, next) => {
  try {
    // Try to get token from httpOnly cookie first, then fallback to Authorization header
    let token = req.cookies?.accessToken;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (token) {
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
