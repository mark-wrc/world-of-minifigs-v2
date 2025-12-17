import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  useResetPasswordMutation,
  useForgotPasswordMutation,
} from "@/redux/api/authApi";
import { passwordRequirementsConfig } from "@/constant/passwordRequirements";

export const useResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [resendEmail, setResendEmail] = useState("");
  const [showPasswordRequirements, setShowPasswordRequirements] =
    useState(false);
  const [resetStatus, setResetStatus] = useState("validating");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);

  const [resetPassword, { isLoading }] = useResetPasswordMutation();
  const [forgotPassword, { isLoading: isResending }] =
    useForgotPasswordMutation();

  const hasValidated = useRef(false);
  const isValidating = useRef(false);

  // Password requirement checks
  const passwordRequirements = {
    minLength: formData.password.length >= 6,
    hasUppercase: /[A-Z]/.test(formData.password),
    hasLowercase: /[a-z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password),
    hasSpecialChar: /[!@#$%^&*_]/.test(formData.password),
  };

  const isPasswordValid =
    passwordRequirements.minLength &&
    passwordRequirements.hasUppercase &&
    passwordRequirements.hasLowercase &&
    passwordRequirements.hasNumber &&
    passwordRequirements.hasSpecialChar;

  // Validate token on mount
  useEffect(() => {
    if (hasValidated.current || isValidating.current) return;

    if (!token) {
      hasValidated.current = true;
      setResetStatus("error");
      toast.error("Reset link missing", {
        description:
          "No reset token found. Please use the link from your email.",
      });
      return;
    }

    const validateToken = async () => {
      isValidating.current = true;

      try {
        await resetPassword({ token, password: "" }).unwrap();
        setResetStatus("idle");
      } catch (error) {
        const message = error?.data?.message?.toLowerCase() || "";

        if (message.includes("expired") || message.includes("invalid")) {
          hasValidated.current = true;
          setResetStatus("error");
          toast.error(error?.data?.message || "Reset link expired", {
            description:
              error?.data?.description ||
              "Please request a new password reset link.",
          });
        } else {
          hasValidated.current = true;
          setResetStatus("idle");
        }
      } finally {
        isValidating.current = false;
      }
    };

    validateToken();
  }, [token, resetPassword]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownSeconds]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordFocus = () => {
    setShowPasswordRequirements(true);
  };

  const handlePasswordBlur = () => {
    if (formData.password === "") {
      setShowPasswordRequirements(false);
    }
  };

  const handleGoToLogin = () => {
    setAuthOpen(true);
  };

  const handleGoHome = () => {
    navigate("/");
  };

  const validateForm = () => {
    if (!formData.password) {
      toast.error("Password is required", {
        description: "Please enter a new password.",
      });
      return false;
    }

    if (!isPasswordValid) {
      if (!passwordRequirements.minLength) {
        toast.error("Password must be at least 6 characters", {
          description:
            "Your password needs to be longer to meet security requirements.",
        });
      } else if (!passwordRequirements.hasUppercase) {
        toast.error("Password must contain at least one uppercase letter", {
          description:
            "Add at least one capital letter (A-Z) to your password.",
        });
      } else if (!passwordRequirements.hasLowercase) {
        toast.error("Password must contain at least one lowercase letter", {
          description:
            "Add at least one lowercase letter (a-z) to your password.",
        });
      } else if (!passwordRequirements.hasNumber) {
        toast.error("Password must contain at least one number", {
          description: "Add at least one number (0-9) to your password.",
        });
      } else if (!passwordRequirements.hasSpecialChar) {
        toast.error(
          "Password must contain at least one special character (!@#$%^&*_)",
          {
            description:
              "Add at least one special character to strengthen your password.",
          }
        );
      }
      return false;
    }

    if (!formData.confirmPassword) {
      toast.error("Confirm password is required", {
        description: "Please re-enter your new password.",
      });
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords don't match", {
        description: "Please make sure both fields contain the same value.",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const response = await resetPassword({
        token,
        password: formData.password,
      }).unwrap();

      toast.success(response?.message || "Password reset successful", {
        description:
          response?.description ||
          "You can now sign in with your new password.",
      });

      setResetStatus("success");
    } catch (error) {
      console.error("Reset password error:", error);

      if (error?.status === 429) {
        const windowSeconds = Number(error?.data?.windowSeconds) || 15 * 60;
        setCooldownSeconds(windowSeconds);
        toast.error(error?.data?.message || "Too many attempts", {
          description:
            error?.data?.description || "Please wait before trying again.",
        });
        return;
      }

      const message = error?.data?.message?.toLowerCase() || "";
      if (message.includes("expired") || message.includes("invalid")) {
        setResetStatus("error");
      }

      toast.error(error?.data?.message || "Password reset failed", {
        description:
          error?.data?.description ||
          "Unable to reset password. Please try again.",
      });
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    const email = resendEmail.trim().toLowerCase();

    if (!email) {
      toast.error("Email is required", {
        description: "Please enter the email associated with your account.",
      });
      return;
    }

    try {
      const response = await forgotPassword({ email }).unwrap();

      toast.success(response?.message || "Reset link sent", {
        description:
          response?.description || "Check your email for the new reset link.",
      });
    } catch (error) {
      console.error("Resend reset link error:", error);

      if (error?.status === 429) {
        const windowSeconds = Number(error?.data?.windowSeconds) || 15 * 60;
        setCooldownSeconds(windowSeconds);
        toast.error(error?.data?.message || "Too many requests", {
          description:
            error?.data?.description || "Please wait before trying again.",
        });
        return;
      }

      toast.error(error?.data?.message || "Unable to send reset link", {
        description: error?.data?.description || "Please try again later.",
      });
    }
  };

  return {
    formData,
    isLoading,
    resetStatus,
    showPasswordRequirements,
    passwordRequirements,
    passwordRequirementsConfig,
    cooldownSeconds,
    isSubmitDisabled: isLoading || cooldownSeconds > 0,
    authOpen,
    setAuthOpen,
    resendEmail,
    setResendEmail,
    isResending,
    handleChange,
    handlePasswordFocus,
    handlePasswordBlur,
    handleSubmit,
    handleResend,
    handleGoToLogin,
    handleGoHome,
  };
};
