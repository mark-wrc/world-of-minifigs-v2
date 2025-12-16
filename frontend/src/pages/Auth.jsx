import React from "react";
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
import { useLogin } from "@/hooks/useLogin";
import { useRegister } from "@/hooks/useRegister";

const Auth = ({ open, onOpenChange, defaultTab = "login" }) => {
  const {
    formData: loginFormData,
    isLoading: isLoginLoading,
    cooldownSeconds: loginCooldownSeconds,
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
    cooldownSeconds: registerCooldownSeconds,
    isSubmitDisabled: isRegisterDisabled,
    handleChange: handleRegisterChange,
    handleCheckboxChange,
    handlePasswordFocus,
    handlePasswordBlur,
    handleSubmit: handleRegisterSubmit,
  } = useRegister(() => onOpenChange(false));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Welcome to {APP_NAME}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Please sign in to your account to continue.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab}>
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
              cooldownSeconds={loginCooldownSeconds}
              isSubmitDisabled={isLoginDisabled}
              handleChange={handleLoginChange}
              handleSubmit={handleLoginSubmit}
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
              cooldownSeconds={registerCooldownSeconds}
              isSubmitDisabled={isRegisterDisabled}
              handleChange={handleRegisterChange}
              handleCheckboxChange={handleCheckboxChange}
              handlePasswordFocus={handlePasswordFocus}
              handlePasswordBlur={handlePasswordBlur}
              handleSubmit={handleRegisterSubmit}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default Auth;
