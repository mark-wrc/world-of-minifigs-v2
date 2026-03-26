import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useRegisterMutation } from "@/redux/api/authApi";
import { passwordRequirementsConfig } from "@/constant/passwordRequirements";
import { handleApiError } from "@/utils/apiHelpers";
import {
  validateEmail,
  sanitizePhone,
  validatePhone,
  getPasswordRequirements,
  isPasswordValid,
  showPasswordError,
} from "@/utils/validation";

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
  const [register, { isLoading }] = useRegisterMutation();
  const navigate = useNavigate();

  // Password requirement checks
  const passwordRequirements = getPasswordRequirements(formData.password);
  const passwordValid = isPasswordValid(passwordRequirements);
  const isEmailValid = validateEmail(formData.email);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "contactNumber") {
      setFormData((prev) => ({ ...prev, contactNumber: sanitizePhone(value) }));
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

    if (!validatePhone(formData.contactNumber)) {
      toast.error("Invalid contact number", {
        description: "Please enter a valid 10-digit US phone number, e.g. (555) 123-4567.",
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

    if (!passwordValid) {
      showPasswordError(passwordRequirements);
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
        navigate("/verify-email", {
          state: {
            email: userData.email,
            from: "register",
          },
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
      handleApiError(
        error,
        "Registration error occurred",
        "Unable to create account. Please check your information and try again.",
      );
    }
  };

  return {
    formData,
    isLoading,
    showPasswordRequirements,
    passwordRequirements,
    passwordRequirementsConfig,
    isSubmitDisabled: isLoading || !formData.agreeToTerms,
    handleChange,
    handleCheckboxChange,
    handlePasswordFocus,
    handlePasswordBlur,
    handleSubmit,
  };
};
