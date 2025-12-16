import * as React from "react";
import { cn } from "@/components/ui/lib/utils";

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground dark:placeholder:text-secondary-foreground/50 selection:bg-accent selection:text-foreground dark:selection:text-secondary-foreground dark:bg-foreground dark:text-secondary-foreground border-border/50 dark:border-input/30 min-h-16 w-full rounded-md border bg-transparent px-3 py-2 transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 text-sm",
        "focus-visible:ring-accent focus-visible:ring-2",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export { Textarea };
