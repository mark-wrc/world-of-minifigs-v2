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
  // Keep the title in place and scroll only what is under it. Off by default.
  fixedTitle = false,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          fixedTitle
            ? `${className} flex flex-col overflow-hidden`
            : className
        }
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            This is for Order Details
          </DialogDescription>
        </DialogHeader>

        {fixedTitle ? (
          <div className="min-h-0 flex-1 overflow-y-auto -mx-5 px-5 -mb-5 pb-5 space-y-5">
            <div className="space-y-5">{children}</div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {footerActions}
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-5">{children}</div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {footerActions}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ViewAdminDialog;
