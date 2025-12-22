import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const AddUpdateItemDialog = ({
  open,
  onOpenChange,
  mode = "add", // "add" or "edit"
  title,
  description,
  onSubmit,
  isLoading = false,
  submitButtonText,
  children,
}) => {
  // Default titles and descriptions based on mode
  const defaultTitle = mode === "edit" ? "Edit Item" : "Add New Item";
  const defaultDescription =
    mode === "edit"
      ? "Update the item details."
      : "Create a new item for your store.";
  const defaultSubmitText = mode === "edit" ? "Update" : "Create";

  const dialogTitle = title || defaultTitle;
  const dialogDescription = description || defaultDescription;
  const buttonText = submitButtonText || defaultSubmitText;
  const loadingText = mode === "edit" ? "Updating..." : "Creating...";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {dialogDescription && (
            <DialogDescription>{dialogDescription}</DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5">
          {children}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button variant="accent" type="submit" disabled={isLoading}>
              {isLoading ? loadingText : buttonText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddUpdateItemDialog;
