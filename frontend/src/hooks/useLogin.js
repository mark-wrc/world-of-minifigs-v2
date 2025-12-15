import { useState } from "react";
import { toast } from "sonner";
import { useLoginMutation } from "@/redux/api/authApi";

export const useLogin = (onSuccess) => {
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
        password: formData.password.trim(), // trim to match validation
      };

      const response = await login(credentials).unwrap();

      toast.success(response?.message || "Login completed", {
        description:
          response?.description || "You have been signed in successfully.",
      });

      if (onSuccess) {
        onSuccess();
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
    handleChange,
    handleSubmit,
  };
};
