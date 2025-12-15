import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import sendEmail from "../utils/sendEmail.js";
import { getVerificationEmailTemplate } from "../utils/Email/verifyEmail.js";
import { generateTokens, verifyRefreshToken } from "../utils/generateToken.js";

//------------------------------------------------ Register User ------------------------------------------
export const register = async (req, res) => {
  try {
    const { firstName, lastName, username, email, contactNumber, password } =
      req.body;

    // Validate required fields
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

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username.toLowerCase() },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          existingUser.email === email.toLowerCase()
            ? "Email already registered"
            : "Username already taken",
        description:
          existingUser.email === email.toLowerCase()
            ? "An account with this email already exists. Please sign in or use a different email."
            : "This username is already taken. Please choose a different username.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(
      verificationTokenExpiry.getHours() +
        parseInt(process.env.EMAIL_VERIFICATION_EXPIRY || "24")
    );

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      contactNumber,
      password: hashedPassword,
      verificationToken,
      verificationTokenExpiry,
      isVerified: false,
    });

    // Generate verification URL
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    // Send verification email
    try {
      await sendEmail({
        email: user.email,
        subject: "Verify Your Email Address - World of Minifigs",
        message: getVerificationEmailTemplate(user, verificationUrl),
      });
    } catch (emailError) {
      console.error("Error sending verification email:", emailError);
      // Don't fail registration if email fails, but log it
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

    res.status(201).json({
      success: true,
      message: "Your account has been created",
      description: "Please check your email to verify your account.",
      user: userResponse,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      description:
        "An unexpected error occurred during registration. Please try again.",
      error: error.message,
    });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
        description: "Please provide the email you used to register.",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Email not found",
        description:
          "We couldn’t find an account registered with that email. Please check or try again with a different email.",
      });
    }

    if (user.isVerified) {
      return res.status(200).json({
        success: true,
        message: "Email already verified",
        description: "You can sign in to your account.",
      });
    }

    // Generate a fresh verification token and expiry (default 1 hour)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(
      verificationTokenExpiry.getHours() +
        parseInt(process.env.EMAIL_VERIFICATION_EXPIRY || "1")
    );

    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = verificationTokenExpiry;
    await user.save();

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    await sendEmail({
      email: user.email,
      subject: "Verify Your Email Address - World of Minifigs",
      message: getVerificationEmailTemplate(user, verificationUrl),
    });

    return res.status(200).json({
      success: true,
      message: "Verification email sent",
      description:
        "A new verification link has been sent to your email address.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to resend verification email",
      description:
        "An unexpected error occurred while sending the verification email. Please try again.",
      error: error.message,
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
    };

    // Set refresh token as httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: refreshTokenDays * 24 * 60 * 60 * 1000, // match JWT_REFRESH_TOKEN_EXPIRY
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      description: "Welcome back!",
      user: userResponse,
      accessToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      description:
        "An unexpected error occurred. Please try again in a moment.",
      error: error.message,
    });
  }
};

// Verify Email
export const verifyEmail = async (req, res) => {
  try {
    let { token } = req.query;

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
      // If decoding fails, use original token
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
          "The verification link is not valid. It may have been changed or already replaced. Please request a new verification email.",
      });
    }

    // Check if token has expired first
    if (
      user.verificationTokenExpiry &&
      user.verificationTokenExpiry < new Date()
    ) {
      // Do NOT clear token here so repeat clicks still show 'expired'
      return res.status(400).json({
        success: false,
        message: "Verification link expired",
        description:
          "The verification link has expired. Please enter your registered email to get a new link.",
      });
    }

    // Check if already verified
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
      error: error.message,
    });
  }
};

// Logout User
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

    // Clear refresh token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
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
      error: error.message,
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

    // Verify refresh token
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

    // Check if refresh token matches
    if (user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
        description:
          "Your session is invalid. Please sign in again to continue.",
      });
    }

    // Check if refresh token has expired
    if (!user.refreshTokenExpiry || user.refreshTokenExpiry < new Date()) {
      return res.status(401).json({
        success: false,
        message: "Session expired",
        description:
          "Your session has expired. Please sign in again to continue.",
      });
    }

    // Generate new access token
    const { accessToken } = generateTokens(user._id);

    res.status(200).json({
      success: true,
      accessToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Token refresh failed",
      description:
        "An unexpected error occurred while refreshing your session. Please sign in again.",
      error: error.message,
    });
  }
};
