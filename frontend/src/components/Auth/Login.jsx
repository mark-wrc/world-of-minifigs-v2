import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const Login = ({
  formData,
  isLoading,
  cooldownSeconds,
  isSubmitDisabled,
  handleChange,
  handleSubmit,
}) => {
  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-2 mb-3">
        <Label htmlFor="login-identifier">Email or Username</Label>
        <Input
          type="text"
          name="identifier"
          placeholder="Enter your email or username"
          autoComplete="username"
          id="login-identifier"
          value={formData.identifier}
          onChange={handleChange}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          type="password"
          name="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          id="login-password"
          value={formData.password}
          onChange={handleChange}
          required
        />
      </div>

      <div className="flex items-center justify-end mb-5">
        <Button
          variant="link"
          type="button"
          className="text-destructive dark:text-accent"
        >
          Forgot Password?
        </Button>
      </div>

      <Button
        type="submit"
        variant="accent"
        className="w-full"
        disabled={isSubmitDisabled}
      >
        {isLoading
          ? "Signing in..."
          : cooldownSeconds > 0
          ? `Try again in ${cooldownSeconds}s`
          : "Sign In"}
      </Button>
    </form>
  );
};

export default Login;
