import React from "react";
import { Link } from "react-router-dom";
import { Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Register = ({
  onLinkClick,
  formData,
  isLoading,
  showPasswordRequirements,
  passwordRequirements,
  passwordRequirementsConfig,
  cooldownSeconds,
  isSubmitDisabled,
  handleChange,
  handleCheckboxChange,
  handlePasswordFocus,
  handlePasswordBlur,
  handleSubmit,
}) => {
  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
        {/* First Name */}
        <div className="space-y-2 mb-2">
          <Label htmlFor="reg-firstname">First Name</Label>
          <Input
            id="reg-firstname"
            name="firstName"
            type="text"
            placeholder="John"
            autoComplete="given-name"
            value={formData.firstName}
            onChange={handleChange}
            required
          />
        </div>

        {/* Last Name */}
        <div className="space-y-2 mb-2">
          <Label htmlFor="reg-lastname">Last Name</Label>
          <Input
            id="reg-lastname"
            name="lastName"
            type="text"
            placeholder="Doe"
            autoComplete="family-name"
            value={formData.lastName}
            onChange={handleChange}
            required
          />
        </div>

        {/* Username */}
        <div className="space-y-2 mb-2">
          <Label htmlFor="reg-username">Username</Label>
          <Input
            id="reg-username"
            name="username"
            type="text"
            placeholder="johndoe"
            autoComplete="username"
            value={formData.username}
            onChange={handleChange}
            required
          />
        </div>

        {/* Contact Number */}
        <div className="space-y-2 mb-2">
          <Label htmlFor="reg-contact">Contact Number</Label>
          <Input
            id="reg-contact"
            name="contactNumber"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]{11}"
            maxLength={11}
            minLength={11}
            placeholder="01234567890"
            autoComplete="tel"
            value={formData.contactNumber}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      {/* Email Address */}
      <div className="space-y-2 mb-3">
        <Label htmlFor="reg-email">Email Address</Label>
        <Input
          id="reg-email"
          name="email"
          type="email"
          placeholder="john@example.com"
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>

      {/* Password */}
      <div className="space-y-2 mb-3 relative">
        <Label htmlFor="reg-password">Password</Label>
        <Input
          id="reg-password"
          name="password"
          type="password"
          placeholder="Create a password"
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
                  <li key={requirement.key} className="flex items-center gap-2">
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

      {/* Confirm Password */}
      <div className="space-y-2 mb-2">
        <Label htmlFor="reg-confirm">Confirm Password</Label>
        <Input
          id="reg-confirm"
          name="confirmPassword"
          type="password"
          placeholder="Confirm your password"
          autoComplete="new-password"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
        />
      </div>

      {/* Terms and Conditions */}
      <div className="flex items-start gap-2 text-sm my-5">
        <Checkbox
          id="reg-terms"
          name="agreeToTerms"
          checked={formData.agreeToTerms}
          onCheckedChange={handleCheckboxChange}
          className="mt-1"
          required
        />
        <p className="text-sm font-normal leading-relaxed">
          By proceeding, you acknowledge that you have read, understood, and
          agree to our{" "}
          <Link
            to="/terms-of-use"
            onClick={onLinkClick}
            className="dark:text-accent underline font-medium"
          >
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link
            to="/privacy-policy"
            onClick={onLinkClick}
            className="dark:text-accent underline font-medium"
          >
            Privacy Policy
          </Link>{" "}
        </p>
      </div>

      {/* Register Button */}
      <Button
        type="submit"
        variant="accent"
        className="w-full"
        disabled={isSubmitDisabled}
      >
        {isLoading
          ? "Creating account..."
          : cooldownSeconds > 0
          ? `Try again in ${cooldownSeconds}s`
          : "Create Account"}
      </Button>
    </form>
  );
};

export default Register;
