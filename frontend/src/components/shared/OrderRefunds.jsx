import React from "react";
import { RotateCcw } from "lucide-react";
import { formatCurrency, formatDate } from "@/utils/formatting";

// The refunds made on an order without cancelling it (order.refunds): each
// with its amount, reason, items and status. Renders nothing when there are
// none. Used on the admin order view (`admin` shows refused refunds, where the
// refund came from, the stock state and the "Put back in stock" button via
// `onRestock`) and on the customer's order page.

const STATUS = {
  completed: { label: "Refunded", className: "text-green-600" },
  pending: { label: "Processing", className: "text-amber-600" },
  failed: { label: "Refused, no money moved", className: "text-destructive" },
};

const RESTOCK = {
  done: "Put back in stock",
  held: "Not back in stock yet",
};

const OrderRefunds = ({
  order,
  admin = false,
  size = "sm",
  actions,
  onRestock,
  restockingId,
}) => {
  const refunds = (order?.refunds || []).filter(
    (r) => admin || r.status !== "failed",
  );
  if (!refunds.length) return null;
  const text = size === "md" ? "text-sm" : "text-xs";

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {/* Customer page: same heading size as its other cards. */}
        <span
          className={
            size === "md"
              ? "font-bold text-sm uppercase tracking-widest"
              : "font-semibold text-xs uppercase"
          }
        >
          Refunds
        </span>
        {actions}
      </div>
      {!admin && (
        <p className={`${text} text-muted-foreground`}>
          Refunds go back to your original payment method. Depending on your
          bank, they may take 5–10 business days to appear.
        </p>
      )}
      {refunds.map((r) => {
        const status = STATUS[r.status] || STATUS.pending;
        return (
          <div key={r._id} className="rounded-lg border divide-y">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/30">
              <span className={`${text} font-bold inline-flex items-center gap-1`}>
                <RotateCcw className="size-3.5" />
                {formatCurrency(r.amount)}
                <span className="font-normal text-muted-foreground">
                  · {formatDate(r.createdAt)}
                </span>
              </span>
              <span className={`${text} font-semibold ${status.className}`}>
                {status.label}
              </span>
            </div>
            {r.reason && (
              <div className={`p-3 ${text}`}>
                <span className="text-muted-foreground">Reason: </span>
                {r.reason}
              </div>
            )}
            {(r.lines || []).map((line, i) => (
              <div key={i} className={`flex justify-between gap-3 p-3 ${text}`}>
                <span>
                  {line.name}
                  {admin && line.fromBackorder > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      ({line.fromBackorder} were backordered)
                    </span>
                  )}
                </span>
                <span className="font-semibold shrink-0">× {line.quantity}</span>
              </div>
            ))}
            {admin && (r.source === "gateway" || r.error || RESTOCK[r.restock]) && (
              <div className={`flex flex-wrap items-center justify-between gap-2 p-3 ${text} text-muted-foreground`}>
                <span>
                  {[
                    r.source === "gateway" && "Made in the payment provider's dashboard",
                    r.error,
                    RESTOCK[r.restock],
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {r.restock === "held" && onRestock && (
                  <button
                    type="button"
                    onClick={() => onRestock(r)}
                    disabled={restockingId === r._id}
                    className="font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    {restockingId === r._id ? "Putting back…" : "Put back in stock"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
};

export default OrderRefunds;
