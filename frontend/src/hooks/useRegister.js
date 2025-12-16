import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRegisterMutation } from "@/redux/api/authApi";
import { passwordRequirementsConfig } from "@/constant/passwordRequirements";

export const useRegister = (onSuccess) => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    contactNumber: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
  });

  const [showPasswordRequirements, setShowPasswordRequirements] =
    useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [register, { isLoading }] = useRegisterMutation();

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

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim());

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const id = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(id);
  }, [cooldownSeconds]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "contactNumber") {
      const digitsOnly = value.replace(/\D/g, "");
      setFormData((prev) => ({ ...prev, contactNumber: digitsOnly }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCheckboxChange = (checked) => {
    setFormData((prev) => ({ ...prev, agreeToTerms: checked }));
  };

  const handlePasswordFocus = () => {
    setShowPasswordRequirements(true);
  };

  const handlePasswordBlur = () => {
    if (formData.password === "") {
      setShowPasswordRequirements(false);
    }
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      toast.error("First name is required", {
        description: "Please enter your first name.",
      });
      return false;
    }

    if (!formData.lastName.trim()) {
      toast.error("Last name is required", {
        description: "Please enter your last name.",
      });
      return false;
    }

    if (!formData.username.trim()) {
      toast.error("Username is required", {
        description: "Please choose a username.",
      });
      return false;
    }

    if (!formData.contactNumber.trim()) {
      toast.error("Contact number is required", {
        description: "Please enter your contact number.",
      });
      return false;
    }

    const digitsOnly = formData.contactNumber.trim();
    if (!/^[0-9]{11}$/.test(digitsOnly)) {
      toast.error("Contact number must be 11 digits", {
        description: "Please enter exactly 11 numeric digits.",
      });
      return false;
    }

    if (!formData.email.trim()) {
      toast.error("Email is required", {
        description: "Please enter your email address.",
      });
      return false;
    }

    if (!isEmailValid) {
      toast.error("Please enter a valid email address", {
        description:
          "The email format is incorrect. Please check and try again.",
      });
      return false;
    }

    if (!formData.password) {
      toast.error("Password is required", {
        description: "Please create a password.",
      });
      return false;
    }

    if (!formData.confirmPassword) {
      toast.error("Confirm password is required", {
        description: "Please re-enter your password.",
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

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords don't match", {
        description: "Please make sure both fields contain the same value.",
      });
      return false;
    }

    if (!formData.agreeToTerms) {
      toast.error("Terms & Conditions not accepted", {
        description: "Please accept the terms to continue.",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const userData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        username: formData.username.trim().toLowerCase(),
        email: formData.email.trim().toLowerCase(),
        contactNumber: formData.contactNumber.trim(),
        password: formData.password.trim(),
      };

      const response = await register(userData).unwrap();

      if (response?.emailSent === false) {
        toast.warning(response?.message || "Account created", {
          description:
            response?.description ||
            "Your account was created, but verification email failed. Please use 'Resend verification' to get your link.",
        });
      } else {
        toast.success(response?.message || "Account creation completed", {
          description:
            response?.description ||
            "Your account has been created. Please check your email to verify.",
        });
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Registration error:", error);

      if (error?.status === 429) {
        const windowSeconds = Number(error?.data?.windowSeconds) || 15 * 60; // fallback 15 min
        setCooldownSeconds(windowSeconds);

        toast.error(error?.data?.message || "Too many registration attempts", {
          description:
            error?.data?.description ||
            "You have made too many registration attempts. Please wait a few minutes before trying again.",
        });
        return;
      }

      toast.error(error?.data?.message || "Registration error occurred", {
        description:
          error?.data?.description ||
          "Unable to create account. Please check your information and try again.",
      });
    }
  };

  return {
    formData,
    isLoading,
    showPasswordRequirements,
    passwordRequirements,
    passwordRequirementsConfig,
    cooldownSeconds,
    isSubmitDisabled:
      isLoading || cooldownSeconds > 0 || !formData.agreeToTerms,
    handleChange,
    handleCheckboxChange,
    handlePasswordFocus,
    handlePasswordBlur,
    handleSubmit,
  };
};
