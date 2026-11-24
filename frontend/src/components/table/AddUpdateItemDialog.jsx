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
  entityName = "Item",
  title,
  description,
  onSubmit,
  isLoading = false,
  submitButtonText,
  children,
  className = "sm:max-w-xl", // Default size
  // Keep the title at the top and the buttons at the bottom, and scroll only
  // the form between them. Off by default.
  pinTitleAndButtons = false,
}) => {
  const modeConfig = {
    add: {
      title: `Add ${entityName}`,
      description: `Create a new ${entityName.toLowerCase()} record`,
      submitText: `Create ${entityName}`,
      loadingText: "Creating...",
    },
    edit: {
      title: `Edit ${entityName}`,
      description: `Update the selected ${entityName.toLowerCase()} record`,
      submitText: `Update ${entityName}`,
      loadingText: "Updating...",
    },
  };

  const config = modeConfig[mode];

  const dialogTitle = title || config.title;
  const dialogDescription = description || config.description;
  const buttonText = submitButtonText || config.submitText;
  const loadingText = config.loadingText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          pinTitleAndButtons
            ? `${className} flex flex-col overflow-hidden`
            : className
        }
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {dialogDescription && (
            <DialogDescription>{dialogDescription}</DialogDescription>
          )}
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(e);
          }}
          className={
            pinTitleAndButtons ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-5"
          }
        >
          {pinTitleAndButtons ? (
            <div className="min-h-0 flex-1 overflow-y-auto -mx-5 px-5 pb-1">
              {children}
            </div>
          ) : (
            children
          )}
          <DialogFooter
            className={pinTitleAndButtons ? "-mx-5 px-5 pt-4 border-t" : undefined}
          >
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
