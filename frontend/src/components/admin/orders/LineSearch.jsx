import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

// Search box over an order's line items in the backorder and refund dialogs.
// It only hides lines from view: quantities typed for hidden lines are kept.

const LineSearch = ({ value, onChange, shown, total, disabled }) => (
  <div className="space-y-1">
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search items..."
        aria-label="Search items"
        disabled={disabled}
        className="h-9 pl-8 pr-8"
        // Enter in the box must not submit the dialog.
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          title="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
    {value && (
      <p className="text-xs text-muted-foreground">
        Showing {shown} of {total} items
      </p>
    )}
  </div>
);

export default LineSearch;
