import { useState } from "react";
import { toast } from "sonner";
import { useSendContactMessageMutation } from "@/redux/api/userApi";

export const useContactForm = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    consent: false,
  });

  const [sendContact, { isLoading }] = useSendContactMessageMutation();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleConsentChange = (checked) => {
    setFormData((prev) => ({
      ...prev,
      consent: Boolean(checked),
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required", {
        description: "Please enter your name.",
      });
      return false;
    }

    if (!formData.email.trim()) {
      toast.error("Email is required", {
        description: "Please enter your email address.",
      });
      return false;
    }

    if (!formData.message.trim()) {
      toast.error("Message is required", {
        description: "Please enter your message.",
      });
      return false;
    }

    if (!formData.consent) {
      toast.error("Terms & Privacy Policy not accepted", {
        description:
          "Please agree to the Terms and Privacy Policy to continue.",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const { name, email, subject, message } = formData;

    try {
      const response = await sendContact({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      }).unwrap();

      toast.success(response?.message || "Message sent", {
        description: response?.description || "Thank you for reaching out.",
      });

      setFormData({
        name: "",
        email: "",
        subject: "",
        message: "",
        consent: false,
      });
    } catch (error) {
      console.error("Contact form error:", error);

      toast.error(error?.data?.message || "Unable to send your message", {
        description:
          error?.data?.description ||
          "An unexpected error occurred while sending your message. Please try again later.",
      });
    }
  };

  return {
    formData,
    isLoading,
    handleChange,
    handleConsentChange,
    handleSubmit,
  };
};
