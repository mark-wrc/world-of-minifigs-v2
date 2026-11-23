import React from "react";
import { Clock, ExternalLink, Truck } from "lucide-react";
import { formatDate } from "@/utils/formatting";
import { getBackorderShipments } from "@shared/orderLines";

// The later shipments of an order: items that were out of stock when the order
// shipped and follow as Shipment 2, 3, … Each shows its items and either
// "Awaiting shipment" or its own tracking. Renders nothing for an order with no
// backorder. Used on the admin order view (`admin` shows staff notes) and on the
// customer's order page.
const BackorderShipments = ({ order, admin = false, size = "sm", actions }) => {
  if (!order || order.status === "cancelled") return null;
  const shipments = getBackorderShipments(order);
  if (!shipments.length) return null;

  const text = size === "md" ? "text-sm" : "text-xs";
  const awaiting = shipments.some((s) => s.status === "awaiting");

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-xs uppercase">
          {awaiting ? "Items Shipping Separately" : "Later Shipments"}
        </span>
        {actions}
      </div>
      <p className={`${text} text-muted-foreground`}>
        {awaiting
          ? order.status === "shipped" || order.status === "delivered"
            ? "The rest of this order has shipped. These items were out of stock and will follow in their own package."
            : "These items are out of stock and will ship separately once they arrive. The rest of the order ships first."
          : "These items shipped separately from the rest of the order."}
      </p>
      {shipments.map((s) => {
        const isWaiting = s.status === "awaiting";
        return (
          <div
            key={`${s.generation}-${s.status}`}
            className={`rounded-lg border divide-y ${isWaiting ? "border-amber-300 dark:border-amber-700" : ""}`}
          >
            <div
              className={`flex flex-wrap items-center justify-between gap-2 p-3 ${isWaiting ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted/30"}`}
            >
              <span className={`${text} font-bold`}>Shipment {s.generation}</span>
              <span
                className={`inline-flex items-center gap-1 ${text} font-semibold ${isWaiting ? "text-amber-700 dark:text-amber-400" : "text-blue-600"}`}
              >
                {isWaiting ? <Clock className="size-3.5" /> : <Truck className="size-3.5" />}
                {isWaiting
                  ? "Awaiting shipment"
                  : `Shipped ${formatDate(s.shipping?.shippedAt)}`}
              </span>
            </div>
            {s.lines.map((line, i) => (
              <div key={i} className={`flex justify-between gap-3 p-3 ${text}`}>
                <span>{line.name}</span>
                <span className="font-semibold shrink-0">× {line.quantity}</span>
              </div>
            ))}
            {!isWaiting && s.shipping?.trackingNumber && (
              <div className={`flex flex-wrap items-center justify-between gap-2 p-3 ${text}`}>
                <span>
                  {s.shipping.carrier} · {s.shipping.trackingNumber}
                </span>
                {s.shipping.trackingLink && (
                  <a
                    href={s.shipping.trackingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    Track this package
                  </a>
                )}
              </div>
            )}
            {admin && isWaiting && s.note && (
              <div className={`p-3 ${text} text-muted-foreground`}>
                Note: {s.note}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
};

export default BackorderShipments;
