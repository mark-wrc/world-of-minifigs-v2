import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useForgotPasswordMutation } from "@/redux/api/authApi";

export const useForgotPassword = (onSuccess) => {
  const [email, setEmail] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownSeconds]);

  const handleChange = (e) => {
    setEmail(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Email is required", {
        description: "Please enter your email address.",
      });
      return;
    }

    try {
      const response = await forgotPassword({ email: trimmedEmail.toLowerCase() }).unwrap();

      toast.success(response?.message || "Email sent", {
        description: response?.description || "Check your email for the reset link.",
      });

      if (onSuccess) onSuccess();
    } catch (error) {
      if (error?.status === 429) {
        const windowSeconds = Number(error?.data?.windowSeconds) || 15 * 60;
        setCooldownSeconds(windowSeconds);
        toast.error(error?.data?.message || "Too many requests", {
          description: error?.data?.description || "Please wait before trying again.",
        });
        return;
      }

      toast.error(error?.data?.message || "Request failed", {
        description: error?.data?.description || "Unable to send reset email. Please try again.",
      });
    }
  };

  return {
    email,
    isLoading,
    cooldownSeconds,
    isSubmitDisabled: isLoading || cooldownSeconds > 0,
    handleChange,
    handleSubmit,
  };
};