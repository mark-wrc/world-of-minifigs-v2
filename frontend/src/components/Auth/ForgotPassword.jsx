import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const ForgotPassword = ({
  email,
  isLoading,
  cooldownSeconds,
  isSubmitDisabled,
  handleChange,
  handleSubmit,
}) => {
  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-2 mb-5">
        <Label htmlFor="forgot-email">Email Address</Label>
        <Input
          type="email"
          name="email"
          placeholder="Enter your email"
          autoComplete="email"
          id="forgot-email"
          value={email}
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
          ? "Sending..."
          : cooldownSeconds > 0
          ? `Try again in ${cooldownSeconds}s`
          : "Send Reset Link"}
      </Button>
    </form>
  );
};

export default ForgotPassword;
