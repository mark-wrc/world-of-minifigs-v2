import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const Register = () => {
  return (
    <form>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="space-y-2 mb-2">
          <Label htmlFor="reg-fullname">Full Name</Label>
          <Input
            id="reg-fullname"
            type="text"
            placeholder="John Doe"
            autoComplete="name"
            className="dark:bg-foreground dark:placeholder:text-secondary-foreground/70"
          />
        </div>
        <div className="space-y-2 mb-2">
          <Label htmlFor="reg-username">Username</Label>
          <Input
            id="reg-username"
            type="text"
            placeholder="johndoe"
            autoComplete="username"
            className="dark:bg-foreground dark:placeholder:text-secondary-foreground/70"
          />
        </div>
        <div className="space-y-2 mb-2">
          <Label htmlFor="reg-contact">Contact Number</Label>
          <Input
            id="reg-contact"
            type="tel"
            placeholder="+1 (555) 000-0000"
            autoComplete="tel"
            className="dark:bg-foreground dark:placeholder:text-secondary-foreground/70"
          />
        </div>
        <div className="space-y-2 mb-3">
          <Label htmlFor="reg-email">Email Address</Label>
          <Input
            id="reg-email"
            type="email"
            placeholder="john@example.com"
            autoComplete="email"
            className="dark:bg-foreground dark:placeholder:text-secondary-foreground/70"
          />
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <Label htmlFor="reg-password">Password</Label>
        <Input
          id="reg-password"
          type="password"
          placeholder="Create a password"
          autoComplete="new-password"
          className="dark:bg-foreground dark:placeholder:text-secondary-foreground/70"
        />
      </div>
      <div className="space-y-2 mb-2">
        <Label htmlFor="reg-confirm">Confirm Password</Label>
        <Input
          id="reg-confirm"
          type="password"
          placeholder="Confirm your password"
          autoComplete="new-password"
          className="dark:bg-foreground dark:placeholder:text-secondary-foreground/70"
        />
      </div>

      <div className="flex items-start gap-2 text-sm text-foreground my-5">
        <Checkbox id="reg-terms" className="mt-1" />
        <Label
          htmlFor="reg-terms"
          className="text-sm font-normal leading-relaxed"
        >
          I agree to the{" "}
          <a
            href="/terms-of-use"
            className="dark:text-accent hover:underline font-medium"
          >
            Terms of Use
          </a>{" "}
          and{" "}
          <a
            href="/privacy-policy"
            className="dark:text-accent hover:underline font-medium"
          >
            Privacy Policy
          </a>
        </Label>
      </div>

      <Button type="submit" variant="accent" className="w-full">
        Register
      </Button>
    </form>
  );
};

export default Register;
