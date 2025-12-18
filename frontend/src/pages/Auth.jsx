import React, { useState, useEffect } from "react";
import { LogIn, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_NAME } from "@/constant/appConfig";
import Login from "@/components/Auth/Login";
import Register from "@/components/Auth/Register";
import ForgotPassword from "@/components/Auth/ForgotPassword";
import { useLogin } from "@/hooks/useLogin";
import { useRegister } from "@/hooks/useRegister";
import { useForgotPassword } from "@/hooks/useForgotPassword";

const Auth = ({ open, onOpenChange, defaultTab = "login" }) => {
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (!open) {
      setShowForgotPassword(false);
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  const {
    formData: loginFormData,
    isLoading: isLoginLoading,
    isSubmitDisabled: isLoginDisabled,
    handleChange: handleLoginChange,
    handleSubmit: handleLoginSubmit,
  } = useLogin(() => onOpenChange(false));

  const {
    formData: registerFormData,
    isLoading: isRegisterLoading,
    showPasswordRequirements,
    passwordRequirements,
    passwordRequirementsConfig,
    isSubmitDisabled: isRegisterDisabled,
    handleChange: handleRegisterChange,
    handleCheckboxChange,
    handlePasswordFocus,
    handlePasswordBlur,
    handleSubmit: handleRegisterSubmit,
  } = useRegister(() => onOpenChange(false));

  const {
    email: forgotEmail,
    isLoading: isForgotLoading,
    isSubmitDisabled: isForgotDisabled,
    handleChange: handleForgotChange,
    handleSubmit: handleForgotSubmit,
  } = useForgotPassword(() => {
    setShowForgotPassword(false);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {showForgotPassword ? "Forgot Password" : `Welcome to ${APP_NAME}`}
          </DialogTitle>
          <DialogDescription className={showForgotPassword ? "" : "sr-only"}>
            {showForgotPassword
              ? "Enter your email to receive a password reset link."
              : "Please sign in to your account to continue."}
          </DialogDescription>
        </DialogHeader>

        {showForgotPassword ? (
          <ForgotPassword
            email={forgotEmail}
            isLoading={isForgotLoading}
            isSubmitDisabled={isForgotDisabled}
            handleChange={handleForgotChange}
            handleSubmit={handleForgotSubmit}
          />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 w-full mb-5">
              <TabsTrigger value="login">
                <LogIn size={18} />
                Login
              </TabsTrigger>
              <TabsTrigger value="register">
                <UserPlus size={18} />
                Register
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Login
                formData={loginFormData}
                isLoading={isLoginLoading}
                isSubmitDisabled={isLoginDisabled}
                handleChange={handleLoginChange}
                handleSubmit={handleLoginSubmit}
                onForgotPassword={() => setShowForgotPassword(true)}
              />
            </TabsContent>
            <TabsContent value="register">
              <Register
                onLinkClick={() => onOpenChange(false)}
                formData={registerFormData}
                isLoading={isRegisterLoading}
                showPasswordRequirements={showPasswordRequirements}
                passwordRequirements={passwordRequirements}
                passwordRequirementsConfig={passwordRequirementsConfig}
                isSubmitDisabled={isRegisterDisabled}
                handleChange={handleRegisterChange}
                handleCheckboxChange={handleCheckboxChange}
                handlePasswordFocus={handlePasswordFocus}
                handlePasswordBlur={handlePasswordBlur}
                handleSubmit={handleRegisterSubmit}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Auth;
