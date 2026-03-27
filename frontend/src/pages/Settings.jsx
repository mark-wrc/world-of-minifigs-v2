import React, { useEffect } from "react";
import { KeyRound, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import useSettings from "@/hooks/useSettings";

const Settings = ({ open, onOpenChange }) => {
  const {
    formData,
    isLoading,
    showNewPasswordRequirements,
    newPasswordRequirements,
    passwordRequirementsConfig,
    handleChange,
    handleNewPasswordFocus,
    handleNewPasswordBlur,
    handleSubmit,
    resetForm,
  } = useSettings();

  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div>
              <DialogTitle className="text-lg">Change Password</DialogTitle>
              <DialogDescription className="text-xs">
                Update your password to keep your account secure.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your current password"
              value={formData.currentPassword}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Enter your new password"
              value={formData.newPassword}
              onChange={handleChange}
              onFocus={handleNewPasswordFocus}
              onBlur={handleNewPasswordBlur}
              disabled={isLoading}
            />

            {showNewPasswordRequirements && (
              <Card className="shadow-none gap-3 border-dashed">
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm">
                    Password Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {passwordRequirementsConfig.map((req) => (
                      <li
                        key={req.key}
                        className="flex items-center gap-2 text-sm"
                      >
                        {newPasswordRequirements[req.key] ? (
                          <Check className="size-4 text-success shrink-0" />
                        ) : (
                          <X className="size-4 text-destructive shrink-0" />
                        )}
                        <span
                          className={
                            newPasswordRequirements[req.key]
                              ? "text-foreground"
                              : "text-destructive"
                          }
                        >
                          {req.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Confirm New Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            variant="accent"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default Settings;
