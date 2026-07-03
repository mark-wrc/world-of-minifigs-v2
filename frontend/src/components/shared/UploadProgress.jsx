import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/components/ui/lib/utils";

// Polished, reusable upload-progress indicator.
//
// Drives off the { isUploading, done, total } shape produced by the admin
// upload hooks. Renders a labelled, animated determinate bar with a shimmer
// sweep; when `total` isn't known yet it falls back to an indeterminate slide.
//
// Usage:
//   {uploadProgress.isUploading && (
//     <UploadProgress done={uploadProgress.done} total={uploadProgress.total} />
//   )}
const UploadProgress = ({
  done = 0,
  total = 0,
  label = "Uploading images",
  className,
}) => {
  const hasTotal = total > 0;
  const pct = hasTotal ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const isComplete = hasTotal && done >= total;

  return (
    <div className={cn("rounded-lg border bg-muted/40 p-3 space-y-2.5", className)}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium text-foreground">
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
          {isComplete ? (
            "Finishing up"
          ) : (
            <>
              {label}
              {hasTotal && (
                <span className="tabular-nums text-muted-foreground">
                  ({done}/{total})
                </span>
              )}
            </>
          )}
        </span>
        {hasTotal && (
          <span className="font-semibold text-primary tabular-nums">{pct}%</span>
        )}
      </div>

      <div
        role="progressbar"
        aria-valuenow={hasTotal ? pct : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="relative h-2 w-full overflow-hidden rounded-full bg-primary/15"
      >
        {hasTotal ? (
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          >
            {/* Shimmer sweep across the filled portion */}
            <div className="h-full w-full animate-upload-shimmer bg-[length:200%_100%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)]" />
          </div>
        ) : (
          // Total not known yet — indeterminate slider
          <div className="absolute inset-y-0 w-2/5 animate-upload-indeterminate rounded-full bg-primary/70" />
        )}
      </div>
    </div>
  );
};

export default UploadProgress;
