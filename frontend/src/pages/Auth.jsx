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
import Login from "@/components/Auth/Login";
import Register from "@/components/Auth/Register";
import { useLogin } from "@/hooks/useLogin";
import { useRegister } from "@/hooks/useRegister";

const Auth = ({ open, onOpenChange, defaultTab = "login" }) => {
  const {
    formData: loginFormData,
    isLoading: isLoginLoading,
    handleChange: handleLoginChange,
    handleSubmit: handleLoginSubmit,
  } = useLogin(() => onOpenChange(false));

  const {
    formData: registerFormData,
    isLoading: isRegisterLoading,
    showPasswordRequirements,
    passwordRequirements,
    passwordRequirementsConfig,
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
            Welcome to World of Minifigs
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
