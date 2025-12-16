import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  useVerifyEmailMutation,
  useResendVerificationMutation,
} from "@/redux/api/authApi";

export const useVerifyEmail = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [verificationStatus, setVerificationStatus] = useState("verifying");
  const [authOpen, setAuthOpen] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [verifyEmail, { isLoading }] = useVerifyEmailMutation();
  const [resendVerification, { isLoading: isResending }] =
    useResendVerificationMutation();

  const hasVerified = useRef(false); // permanently true only after success
  const isVerifying = useRef(false); // prevents double in-flight calls

  useEffect(() => {
    if (hasVerified.current || isVerifying.current) return;

    const token = searchParams.get("token");

    if (!token) {
      hasVerified.current = true; // no token, nothing to retry
      setVerificationStatus("error");
      toast.error("Verification token missing", {
        description:
          "No verification token found. Please use the verification link from your email.",
      });
      return;
    }

    const verify = async () => {
      isVerifying.current = true;

      try {
        const response = await verifyEmail(token).unwrap();

        const isAlreadyVerified = response?.message
          ?.toLowerCase()
          ?.includes("already verified");

        hasVerified.current = true; // mark success
        setVerificationStatus(
          isAlreadyVerified ? "alreadyVerified" : "success"
        );

        // Clear token from URL only after success
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete("token");
        setSearchParams(newSearchParams, { replace: true });

        toast.success(response?.message || "Email verified successfully", {
          description:
            response?.description || "You can now sign in to your account.",
        });
      } catch (error) {
        // allow retry on refresh: do NOT set hasVerified, keep token in URL
        console.error("Verification error:", error);
        setVerificationStatus("error");

        toast.error(
          error?.data?.message ||
            (error?.status === "FETCH_ERROR"
              ? "Connection error"
              : "Email verification error"),
          {
            description:
              error?.data?.description ||
              (error?.status === "FETCH_ERROR"
                ? "Unable to connect to the server. Please check your internet connection and try again."
                : "Unable to verify email. Please check the verification link and try again."),
          }
        );
      } finally {
        isVerifying.current = false;
      }
    };

    verify();
  }, [searchParams, verifyEmail, setSearchParams]);

  const handleGoToLogin = () => {
    setAuthOpen(true);
  };

  const handleResend = async (e) => {
    e.preventDefault();
    const email = resendEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Email is required", {
        description: "Please enter the email you used to register.",
      });
      return;
    }

    try {
      const response = await resendVerification({ email }).unwrap();

      const isAlreadyVerified = response?.message
        ?.toLowerCase()
        ?.includes("already verified");

      if (isAlreadyVerified) {
        setVerificationStatus("alreadyVerified");
      }

      toast.success(response?.message || "Verification email sent", {
        description:
          response?.description ||
          "A new verification link has been sent. Please check your inbox.",
      });
    } catch (error) {
      console.error("Resend verification error:", error);
      toast.error(
        error?.data?.message || "Unable to resend verification email",
        {
          description:
            error?.data?.description ||
            "Please confirm the email address and try again.",
        }
      );
    }
  };

  return {
    verificationStatus,
    authOpen,
    setAuthOpen,
    handleGoToLogin,
    isLoading,
    resendEmail,
    setResendEmail,
    handleResend,
    isResending,
  };
};
