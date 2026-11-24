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
  // Keep the title at the top and the buttons at the bottom, and scroll only
  // what is between them. Off by default.
  pinTitleAndButtons = false,
}) => {
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            This is for Order Details
          </DialogDescription>
        </DialogHeader>

        {pinTitleAndButtons ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto -mx-5 px-5 pb-1 space-y-5">
              {children}
            </div>
            <DialogFooter className="-mx-5 px-5 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {footerActions}
            </DialogFooter>
          </>
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
