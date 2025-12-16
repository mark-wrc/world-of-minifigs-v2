import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLoginMutation } from "@/redux/api/authApi";

export const useLogin = (onSuccess) => {
  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
  });

  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [login, { isLoading }] = useLoginMutation();

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const id = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(id);
  }, [cooldownSeconds]);

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

      toast.success(response?.message || "Login completed", {
        description:
          response?.description || "You have been signed in successfully.",
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Login error:", error);

      if (error?.status === 429) {
        const windowSeconds = Number(error?.data?.windowSeconds) || 15 * 60; // fallback 15 min
        setCooldownSeconds(windowSeconds);

        toast.error(error?.data?.message || "Too many login attempts", {
          description:
            error?.data?.description ||
            "You have made too many login attempts. Please wait a few minutes before trying again.",
        });
        return;
      }

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
    cooldownSeconds,
    isSubmitDisabled: isLoading || cooldownSeconds > 0,
    handleChange,
    handleSubmit,
  };
};
