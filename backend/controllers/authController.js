import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import sendEmail from "../utils/sendEmail.js";
import { getVerificationEmailTemplate } from "../utils/Email/verifyEmail.js";
import { getResetPasswordTemplate } from "../utils/Email/passwordEmail.js";
import { generateTokens, verifyRefreshToken } from "../utils/generateToken.js";

const MIN_RESPONSE_TIME_MS = 3000; // minimum response time
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

//------------------------------------------------ Register User ------------------------------------------
export const register = async (req, res) => {
  try {
    const { firstName, lastName, username, email, contactNumber, password } =
      req.body;

    // Validate required fields (basic check before normalization)
    if (
      !firstName ||
      !lastName ||
      !username ||
      !email ||
      !contactNumber ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
        description: "Please complete all fields to create your account.",
      });
    }

    // Normalize strings
    const firstNameStr = String(firstName).trim();
    const lastNameStr = String(lastName).trim();
    const usernameStr = String(username).trim().toLowerCase();
    const emailStr = String(email).trim().toLowerCase();
    const contactStr = String(contactNumber).trim();
    const passwordStr = String(password);

    // Password strength validation
    const hasMinLength = passwordStr.length >= 6;
    const hasUppercase = /[A-Z]/.test(passwordStr);
    const hasLowercase = /[a-z]/.test(passwordStr);
    const hasNumber = /[0-9]/.test(passwordStr);
    const hasSpecialChar = /[!@#$%^&*_]/.test(passwordStr);

    if (
      !hasMinLength ||
      !hasUppercase ||
      !hasLowercase ||
      !hasNumber ||
      !hasSpecialChar
    ) {
      let message = "Weak password";
      let description =
        "Your password does not meet the minimum security requirements.";

      if (!hasMinLength) {
        message = "Password too short";
        description = "Password must be at least 6 characters long.";
      } else if (!hasUppercase) {
        message = "Missing uppercase letter";
        description =
          "Password must contain at least one uppercase letter (A-Z).";
      } else if (!hasLowercase) {
        message = "Missing lowercase letter";
        description =
          "Password must contain at least one lowercase letter (a-z).";
      } else if (!hasNumber) {
        message = "Missing number";
        description = "Password must contain at least one number (0-9).";
      } else if (!hasSpecialChar) {
        message = "Missing special character";
        description =
          "Password must contain at least one special character (!@#$%^&*_).";
      }

      return res.status(400).json({
        success: false,
        message,
        description,
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: emailStr }, { username: usernameStr }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Account already exists",
        description:
          "An account with these details already exists. Please sign in or use different login details.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(passwordStr, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(
      verificationTokenExpiry.getHours() +
        parseInt(process.env.EMAIL_VERIFICATION_EXPIRY || "24", 10)
    );

    // Create user
    let user;
    try {
      user = await User.create({
        firstName: firstNameStr,
        lastName: lastNameStr,
        username: usernameStr,
        email: emailStr,
        contactNumber: contactStr,
        password: hashedPassword,
        verificationToken,
        verificationTokenExpiry,
        isVerified: false,
      });
    } catch (error) {
      // Handle Mongoose validation errors
      if (error.name === "ValidationError") {
        const errors = error.errors;
        const firstError = Object.values(errors)[0];

        return res.status(400).json({
          success: false,
          message: firstError.message || "Validation error",
          description:
            firstError.message || "Please check your input and try again.",
        });
      }

      // Handle duplicate key error (unique constraint)
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(409).json({
          success: false,
          message: `${field} already exists`,
          description: `An account with this ${field} already exists. Please use a different ${field}.`,
        });
      }

      // Re-throw if it's not a validation error
      throw error;
    }

    // Generate verification URL
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    // Send verification email with improved error handling
    let emailSent = false;

    try {
      await sendEmail({
        email: user.email,
        subject: `Verify Your Email Address - ${
          process.env.SMTP_FROM_NAME || "World of Minifigs"
        }`,
        message: getVerificationEmailTemplate(user, verificationUrl),
      });
      emailSent = true;
    } catch (emailErrorCaught) {
      // Log detailed error for monitoring/debugging
      console.error("Error sending verification email:", {
        userId: user._id,
        email: user.email,
        error: emailErrorCaught.message,
        stack: emailErrorCaught.stack,
        timestamp: new Date().toISOString(),
      });
    }

    // Remove sensitive data from response
    const userResponse = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      contactNumber: user.contactNumber,
      role: user.role,
      isVerified: user.isVerified,
    };

    // Return appropriate response based on email sending status
    if (emailSent) {
      res.status(201).json({
        success: true,
        message: "Your account has been created",
        description: "Please check your email to verify your account.",
        user: userResponse,
      });
    } else {
      // Account created but email failed - inform user they can resend
      res.status(201).json({
        success: true,
        message: "Your account has been created",
        description:
          "Your account was created successfully, but we couldn't send the verification email. Please use the 'Resend verification email' option to receive your verification link.",
        user: userResponse,
        emailSent: false, // Flag for frontend to show resend option
      });
    }
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      description:
        "An unexpected error occurred during registration. Please try again.",
    });
  }
};

// resend verification token
export const resendVerification = async (req, res) => {
  const startTime = Date.now();

  try {
    const { email } = req.body;

    if (!email) {
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME_MS)
        await delay(MIN_RESPONSE_TIME_MS - elapsed);

      return res.status(400).json({
        success: false,
        message: "Email is required",
        description: "Please provide the email you used to register.",
      });
    }

    const emailStr = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: emailStr });

    // Already verified users
    if (user && user.isVerified) {
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME_MS)
        await delay(MIN_RESPONSE_TIME_MS - elapsed);

      return res.status(200).json({
        success: true,
        message: "Email already verified",
        description: "You can sign in to your account.",
      });
    }

    // Handle non-existent or unverified users
    if (user && !user.isVerified) {
      const now = new Date();
      const hasValidExistingToken =
        user.verificationToken &&
        user.verificationTokenExpiry &&
        user.verificationTokenExpiry > now;

      let verificationToken = user.verificationToken;

      if (!hasValidExistingToken) {
        verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationTokenExpiry = new Date();
        verificationTokenExpiry.setHours(
          verificationTokenExpiry.getHours() +
            parseInt(process.env.EMAIL_VERIFICATION_EXPIRY || "1", 10)
        );

        user.verificationToken = verificationToken;
        user.verificationTokenExpiry = verificationTokenExpiry;
        await user.save();
      }

      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

      try {
        await sendEmail({
          email: user.email,
          subject: `Verify Your Email Address - ${
            process.env.SMTP_FROM_NAME || "World of Minifigs"
          }`,
          message: getVerificationEmailTemplate(user, verificationUrl),
        });
      } catch (emailError) {
        console.error("Error sending verification email:", {
          userId: user._id,
          email: user.email,
          error: emailError.message,
          stack: emailError.stack,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_RESPONSE_TIME_MS)
      await delay(MIN_RESPONSE_TIME_MS - elapsed);

    return res.status(200).json({
      success: true,
      message: "Verification email sent",
      description:
        "If an account exists for this email, a verification link has been sent.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);

    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_RESPONSE_TIME_MS)
      await delay(MIN_RESPONSE_TIME_MS - elapsed);

    return res.status(500).json({
      success: false,
      message: "Unable to resend verification email",
      description:
        "An unexpected error occurred while sending the verification email. Please try again.",
    });
  }
};

//------------------------------------------------ Login User ------------------------------------------
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Validate required fields
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/username and password required",
        description:
          "Please enter your email or username and password to sign in.",
      });
    }

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() },
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
        description:
          "The email/username or password you entered is incorrect. Please try again.",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account deactivated",
        description:
          "Your account has been deactivated. Please contact support to reactivate it.",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
        description:
          "The email/username or password you entered is incorrect. Please try again.",
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Update user's last login and refresh token
    const accessTokenDays = Number(process.env.JWT_ACCESS_TOKEN_EXPIRY) || 1;
    const refreshTokenDays = Number(process.env.JWT_REFRESH_TOKEN_EXPIRY) || 7;
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + refreshTokenDays);

    user.lastLogin = new Date();
    user.refreshToken = refreshToken;
    user.refreshTokenExpiry = refreshTokenExpiry;
    await user.save();

    // Remove sensitive data from response
    const userResponse = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      contactNumber: user.contactNumber,
      role: user.role,
      isVerified: user.isVerified,
      profilePicture: user.profilePicture,
    };

    // Set access token as httpOnly cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: accessTokenDays * 24 * 60 * 60 * 1000,
    });

    // Set refresh token as httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTokenDays * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      description: "Welcome back!",
      user: userResponse,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      description:
        "An unexpected error occurred. Please try again in a moment.",
    });
  }
};

// Verify Email
export const verifyEmail = async (req, res) => {
  try {
    let { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
        description: "Please use the verification link from your email.",
      });
    }

    // Decode token in case it was URL encoded
    try {
      token = decodeURIComponent(token);
    } catch (decodeError) {
      console.warn("Token decode warning:", decodeError);
    }

    // Find user by verification token
    const user = await User.findOne({
      verificationToken: token,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Invalid verification link",
        description:
          "The verification link is not valid. It may have been changed or already replaced. Please request a new one.",
      });
    }

    // Check if token has expired
    if (
      user.verificationTokenExpiry &&
      user.verificationTokenExpiry < new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "Verification link expired",
        description:
          "The verification link has expired. Please enter your registered email to get a new one.",
      });
    }

    // Check if already verified
    if (user.isVerified) {
      return res.status(200).json({
        success: true,
        message: "Email is already verified",
        description: "You can sign in to your account.",
      });
    }

    // Verify the user and clear token/expiry to prevent reuse
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email verified",
      description:
        "Your email has been verified successfully. You can now sign in to your account.",
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Verification failed",
      description:
        "An unexpected error occurred during verification. Please try again.",
    });
  }
};

//------------------------------------------------ Logout User ------------------------------------------
export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (refreshToken) {
      // Find user and clear refresh token
      const user = await User.findOne({ refreshToken });
      if (user) {
        user.refreshToken = undefined;
        user.refreshTokenExpiry = undefined;
        await user.save();
      }
    }

    // Clear access token cookie
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    // Clear refresh token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({
      success: true,
      message: "Logout successful",
      description: "You have been signed out successfully.",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed",
      description:
        "An unexpected error occurred during logout. Please try again.",
    });
  }
};

// Get Current User
export const getCurrentUser = async (req, res) => {
  try {
    // User is attached by authenticate middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
        description: "Please sign in to continue.",
      });
    }

    // Remove sensitive data from response
    const userResponse = {
      id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      username: req.user.username,
      email: req.user.email,
      contactNumber: req.user.contactNumber,
      role: req.user.role,
      isVerified: req.user.isVerified,
      profilePicture: req.user.profilePicture,
    };

    return res.status(200).json({
      success: true,
      user: userResponse,
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user information",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

// Refresh Token
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
        description: "Please sign in again to continue.",
      });
    }

    // Verify refresh token signature
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
        description:
          "Your session has expired. Please sign in again to continue.",
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User not found or inactive",
        description:
          "Your account is not available. Please sign in again to continue.",
      });
    }

    // Check if refresh token matches the one stored for this user
    if (user.refreshToken !== refreshToken) {
      // Optional: clear stored token to prevent reuse attempts
      user.refreshToken = undefined;
      user.refreshTokenExpiry = undefined;
      await user.save();

      return res.status(401).json({
        success: false,
        message: "Invalid token",
        description:
          "Your session is invalid. Please sign in again to continue.",
      });
    }

    // Check if refresh token has expired
    if (!user.refreshTokenExpiry || user.refreshTokenExpiry < new Date()) {
      user.refreshToken = undefined;
      user.refreshTokenExpiry = undefined;
      await user.save();

      return res.status(401).json({
        success: false,
        message: "Session expired",
        description:
          "Your session has expired. Please sign in again to continue.",
      });
    }

    // Rotate refresh token: generate new access + refresh tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user._id
    );

    const accessTokenDays = Number(process.env.JWT_ACCESS_TOKEN_EXPIRY) || 1;
    const refreshTokenDays = Number(process.env.JWT_REFRESH_TOKEN_EXPIRY) || 7;
    const newRefreshTokenExpiry = new Date();
    newRefreshTokenExpiry.setDate(
      newRefreshTokenExpiry.getDate() + refreshTokenDays
    );

    user.refreshToken = newRefreshToken;
    user.refreshTokenExpiry = newRefreshTokenExpiry;
    await user.save();

    // Set access token as httpOnly cookie
    res.cookie("accessToken", accessToken, {
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

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Token refresh failed",
      description:
        "An unexpected error occurred while refreshing your session. Please sign in again.",
    });
  }
};

//------------------------------------------------ Forgot Password ------------------------------------------
export const forgotPassword = async (req, res) => {
  const startTime = Date.now();

  try {
    const { email } = req.body;

    if (!email) {
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME_MS)
        await delay(MIN_RESPONSE_TIME_MS - elapsed);

      return res.status(400).json({
        success: false,
        message: "Email is required",
        description:
          "Please provide the email address associated with your account.",
      });
    }

    const emailStr = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: emailStr });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date();
      resetTokenExpiry.setMinutes(
        resetTokenExpiry.getMinutes() +
          parseInt(process.env.PASSWORD_RESET_EXPIRY || "30", 10)
      );

      user.resetPasswordToken = resetToken;
      user.resetPasswordTokenExpiry = resetTokenExpiry;
      await user.save();

      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

      try {
        await sendEmail({
          email: user.email,
          subject: `Reset Your Password - ${
            process.env.SMTP_FROM_NAME || "World of Minifigs"
          }`,
          message: getResetPasswordTemplate(user, resetUrl),
        });
      } catch (emailError) {
        console.error("Error sending password reset email:", {
          userId: user._id,
          email: user.email,
          error: emailError.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_RESPONSE_TIME_MS)
      await delay(MIN_RESPONSE_TIME_MS - elapsed);

    return res.status(200).json({
      success: true,
      message: "Password reset sent",
      description:
        "If an account exists for this email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_RESPONSE_TIME_MS)
      await delay(MIN_RESPONSE_TIME_MS - elapsed);

    return res.status(500).json({
      success: false,
      message: "Unable to process request",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Reset Password ------------------------------------------
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset link",
        description: "Please use the reset link from your email.",
      });
    }

    // Check token FIRST before requiring password
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset link",
        description:
          "The password reset link is invalid or has expired. Please request a new one.",
      });
    }

    // NOW check for password
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
        description: "Please provide a new password.",
      });
    }

    // Password validation
    const passwordStr = String(password);
    const hasMinLength = passwordStr.length >= 6;
    const hasUppercase = /[A-Z]/.test(passwordStr);
    const hasLowercase = /[a-z]/.test(passwordStr);
    const hasNumber = /[0-9]/.test(passwordStr);
    const hasSpecialChar = /[!@#$%^&*_]/.test(passwordStr);

    if (
      !hasMinLength ||
      !hasUppercase ||
      !hasLowercase ||
      !hasNumber ||
      !hasSpecialChar
    ) {
      return res.status(400).json({
        success: false,
        message: "Weak password",
        description:
          "Password must be at least 6 characters with uppercase, lowercase, number, and special character.",
      });
    }

    const hashedPassword = await bcrypt.hash(passwordStr, 10);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpiry = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful",
      description:
        "Your password has been updated. You can now sign in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Password reset failed",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};
