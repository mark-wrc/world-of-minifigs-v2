import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useChangePasswordMutation } from "@/redux/api/authApi";
import { passwordRequirementsConfig } from "@/constant/passwordRequirements";
import { handleApiError, handleApiSuccess } from "@/utils/apiHelpers";
import {
  getPasswordRequirements,
  isPasswordValid,
  showPasswordError,
} from "@/utils/validation";

const INITIAL_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const useSettings = () => {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [showNewPasswordRequirements, setShowNewPasswordRequirements] =
    useState(false);

  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const newPasswordRequirements = getPasswordRequirements(formData.newPassword);
  const newPasswordValid = isPasswordValid(newPasswordRequirements);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleNewPasswordFocus = useCallback(() => {
    setShowNewPasswordRequirements(true);
  }, []);

  const handleNewPasswordBlur = useCallback(() => {
    if (!formData.newPassword) setShowNewPasswordRequirements(false);
  }, [formData.newPassword]);

  const validateForm = () => {
    if (!formData.currentPassword) {
      toast.error("Current password is required", {
        description: "Please enter your current password.",
      });
      return false;
    }

    if (!formData.newPassword) {
      toast.error("New password is required", {
        description: "Please enter a new password.",
      });
      return false;
    }

    if (!newPasswordValid) {
      showPasswordError(newPasswordRequirements);
      return false;
    }

    if (!formData.confirmPassword) {
      toast.error("Please confirm your new password", {
        description: "Re-enter your new password to confirm.",
      });
      return false;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Passwords don't match", {
        description: "The new password and confirmation do not match.",
      });
      return false;
    }

    return true;
  };

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM);
    setShowNewPasswordRequirements(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const response = await changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      }).unwrap();

      handleApiSuccess(response, "Password updated");
      resetForm();
    } catch (error) {
      handleApiError(error, "Failed to change password");
    }
  };

  return {
    formData,
    isLoading,
    showNewPasswordRequirements,
    newPasswordRequirements,
    passwordRequirementsConfig,
    newPasswordValid,
    handleChange,
    handleNewPasswordFocus,
    handleNewPasswordBlur,
    handleSubmit,
    resetForm,
  };
};

export default useSettings;
