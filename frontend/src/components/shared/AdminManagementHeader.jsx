import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const AdminManagementHeader = ({
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {description && (
          <p className="text-sm text-popover-foreground/80 mt-2">{description}</p>
        )}
      </div>

      {actionLabel && (
        <Button variant="accent" onClick={onAction}>
          <Plus className="size-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default AdminManagementHeader;
