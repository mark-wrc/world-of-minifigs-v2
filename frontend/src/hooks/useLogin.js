import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLoginMutation, useLogoutMutation } from "@/redux/api/authApi";
import { setCredentials, clearCredentials } from "@/redux/slices/authSlice";

// ------------------------------------------ Login ------------------------------------------------------------

export const useLogin = (onSuccess) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
  });

  const [login, { isLoading }] = useLoginMutation();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    const trimmedIdentifier = formData.identifier.trim();
    const trimmedPassword = formData.password.trim();

    if (!trimmedIdentifier) {
      toast.error("Email or username is required", {
        description:
          "Please enter the email or username you used for your account.",
      });
      return false;
    }

    if (!trimmedPassword) {
      toast.error("Password is required", {
        description: "Please enter your password.",
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
      const credentials = {
        identifier: formData.identifier.trim().toLowerCase(),
        password: formData.password.trim(),
      };

      const response = await login(credentials).unwrap();

      // Store user in Redux state
      if (response?.user) {
        dispatch(setCredentials(response.user));
        
        // Close auth dialog first
        if (onSuccess) {
          onSuccess();
        }
        
        // Small delay to ensure cookies are set before navigation
        setTimeout(() => {
          // Redirect based on user role
          if (response.user.role === "admin") {
            navigate("/admin/dashboard");
          } else {
            navigate("/");
          }
        }, 100);
      } else {
        // Fallback to home if no user data
        if (onSuccess) {
          onSuccess();
        }
        navigate("/");
      }
    } catch (error) {
      console.error("Login error:", error);

      toast.error(error?.data?.message || "Login error occurred", {
        description:
          error?.data?.description ||
          "Unable to sign in. Please verify your credentials and try again.",
      });
    }
  };

  return {
    formData,
    isLoading,
    isSubmitDisabled: isLoading,
    handleChange,
    handleSubmit,
  };
};

// ------------------------------------------ Log-out ------------------------------------------------------------
// Helper function to get user initials
export const getInitials = (user) => {
  if (!user?.firstName || !user?.lastName) {
    return user?.username?.charAt(0)?.toUpperCase() || "U";
  }
  const firstInitial = user.firstName.charAt(0).toUpperCase();
  const lastInitial = user.lastName.charAt(0).toUpperCase();
  return `${firstInitial}${lastInitial}`;
};

export const useLogout = () => {
  const dispatch = useDispatch();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logout().unwrap();
      dispatch(clearCredentials());
      // Refresh the page to clear any session data
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      // Even if logout fails on server, clear local state
      dispatch(clearCredentials());
      // Refresh the page to clear any session data
      window.location.href = "/";
    }
  };

  return {
    handleLogout,
    isLoggingOut,
  };
};
