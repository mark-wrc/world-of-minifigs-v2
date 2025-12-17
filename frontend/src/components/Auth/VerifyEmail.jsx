import React from "react";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Auth from "@/pages/Auth";
import { useVerifyEmail } from "@/hooks/useVerifyEmail";

const VerifyEmail = () => {
  const {
    verificationStatus,
    authOpen,
    setAuthOpen,
    handleGoToLogin,
    resendEmail,
    setResendEmail,
    handleResend,
    isResending,
  } = useVerifyEmail();

  if (verificationStatus === "verifying") {
    return (
      <>
        <Auth open={authOpen} onOpenChange={setAuthOpen} defaultTab="login" />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-5"></div>
            <p className="text-foreground">Verifying your email...</p>
          </div>
        </div>
      </>
    );
  }

  if (verificationStatus === "error") {
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
                Verification Failed
              </h1>
              <p className="text-accent-foreground">
                We couldn’t use that verification link. Enter your registered
                email to get a new verification link.
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
                {isResending ? "Sending..." : "Resend verification email"}
              </Button>
            </form>
          </div>
        </div>
      </>
    );
  }

  if (verificationStatus === "alreadyVerified") {
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
                Email Already Verified
              </h1>
              <p className="text-accent-foreground">
                Your email has already been verified. You can sign in to your
                account.
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
              Email verification successful!
            </h1>
            <p className="text-accent-foreground">
              Your email has been successfully verified. You can now sign in to
              your account.
            </p>
          </div>
          <Button onClick={handleGoToLogin} variant="accent" className="w-full">
            Sign in
          </Button>
        </div>
      </div>
    </>
  );
};

export default VerifyEmail;