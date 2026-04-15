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

const ViewAdminDialog = ({
  open,
  onOpenChange,
  title = "Details",
  children,
  className = "sm:max-w-xl",
  footerActions,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            This is for Order Details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">{children}</div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {footerActions}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ViewAdminDialog;
