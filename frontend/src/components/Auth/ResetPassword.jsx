import React from "react";
import { CheckCircle2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import Auth from "@/pages/Auth";
import { useResetPassword } from "@/hooks/useResetPassword";

const ResetPassword = () => {
  const {
    formData,
    isLoading,
    resetStatus,
    showPasswordRequirements,
    passwordRequirements,
    passwordRequirementsConfig,
    cooldownSeconds,
    isSubmitDisabled,
    authOpen,
    setAuthOpen,
    resendEmail,
    setResendEmail,
    isResending,
    handleChange,
    handlePasswordFocus,
    handlePasswordBlur,
    handleSubmit,
    handleResend,
    handleGoToLogin,
  } = useResetPassword();

  // Validating token
  if (resetStatus === "validating") {
    return (
      <>
        <Auth open={authOpen} onOpenChange={setAuthOpen} defaultTab="login" />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-5"></div>
            <p className="text-foreground">Validating reset link...</p>
          </div>
        </div>
      </>
    );
  }

  // Error state (invalid or expired token)
  if (resetStatus === "error") {
    return (
      <>
        <Auth open={authOpen} onOpenChange={setAuthOpen} defaultTab="login" />
        <div className="min-h-screen flex items-center justify-center px-5">
          <div className="max-w-xl w-full text-center space-y-6">
            <div>
              <div className="w-20 h-20 mx-auto bg-destructive/10 rounded-full flex items-center justify-center mb-5">
                <X className="w-10 h-10 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Reset Link Invalid
              </h1>
              <p className="text-accent-foreground">
                The password reset link is invalid or has expired. Enter your
                registered email to get a new reset link.
              </p>
            </div>

            <form className="space-y-3" onSubmit={handleResend}>
              <Input
                type="email"
                name="resendEmail"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
              <Button
                type="submit"
                variant="accent"
                className="w-full"
                disabled={isResending}
              >
                {isResending ? "Sending..." : "Send new reset link"}
              </Button>
            </form>
          </div>
        </div>
      </>
    );
  }

  // Success
  if (resetStatus === "success") {
    return (
      <>
        <Auth open={authOpen} onOpenChange={setAuthOpen} defaultTab="login" />
        <div className="min-h-screen flex items-center justify-center">
          <div className="max-w-md w-full text-center">
            <div className="mb-5">
              <div className="w-20 h-20 mx-auto bg-success/10 rounded-full flex items-center justify-center mb-5">
                <CheckCircle2 className="w-10 h-10 text-success" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Password Reset Successful
              </h1>
              <p className="text-accent-foreground">
                Your password has been updated. You can now sign in with your
                new password.
              </p>
            </div>
            <Button
              onClick={handleGoToLogin}
              variant="accent"
              className="w-full"
            >
              Sign in
            </Button>
          </div>
        </div>
      </>
    );
  }

  // Reset form (idle state)
  return (
    <>
      <Auth open={authOpen} onOpenChange={setAuthOpen} defaultTab="login" />
      <div className="min-h-screen flex items-center justify-center px-5">
        <Card className="max-w-xl w-full">
          <CardHeader className="mb-5">
            <CardTitle className="text-2xl">Reset Your Password</CardTitle>
            <CardDescription>Enter your new password below.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reset-password">New Password</Label>
                <Input
                  id="reset-password"
                  name="password"
                  type="password"
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={handlePasswordFocus}
                  onBlur={handlePasswordBlur}
                  required
                />
                {showPasswordRequirements && (
                  <Card className="shadow-none gap-3">
                    <CardHeader>
                      <CardTitle>Password Requirements:</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        {passwordRequirementsConfig.map((requirement) => (
                          <li
                            key={requirement.key}
                            className="flex items-center gap-2"
                          >
                            {passwordRequirements[requirement.key] ? (
                              <Check className="h-4 w-4 text-success" />
                            ) : (
                              <X className="h-4 w-4 text-destructive" />
                            )}
                            <span
                              className={
                                passwordRequirements[requirement.key]
                                  ? "text-foreground"
                                  : "text-destructive"
                              }
                            >
                              {requirement.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-confirm">Confirm Password</Label>
                <Input
                  id="reset-confirm"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="accent"
                className="w-full"
                disabled={isSubmitDisabled}
              >
                {isLoading
                  ? "Resetting..."
                  : cooldownSeconds > 0
                  ? `Try again in ${cooldownSeconds}s`
                  : "Reset Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ResetPassword;
