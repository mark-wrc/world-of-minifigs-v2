import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const Login = () => {
  return (
    <form>
      <div className="space-y-2 mb-3">
        <Label htmlFor="login-identifier">Email or Username</Label>
        <Input
          type="text"
          placeholder="Enter your email or username"
          autoComplete="username"
          id="login-identifier"
          className="dark:bg-foreground dark:placeholder:text-secondary-foreground/70"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          type="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          id="login-password"
          className="dark:bg-foreground dark:placeholder:text-secondary-foreground/70"
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

      <Button type="submit" variant="accent" className="w-full">
        Log In
      </Button>
    </form>
  );
};

export default Login;
