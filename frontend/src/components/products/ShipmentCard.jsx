import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Boxes, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Orders shipped together (Pay Now, Ship Later): one card for the parcel and
// its shipping invoice. Opening it lists every order inside, each linking to
// its own receipt.
// `focused`: opened from a link (the shipped email) — starts expanded,
// scrolls into view and is outlined.
const ShipmentCard = ({ shipmentCard, focused = false }) => {
  const [isOpen, setIsOpen] = useState(focused);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!focused) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focused]);
  const {
    shipmentRef,
    statusConfig,
    createdAt,
    shippingFee,
    shippingInsurance,
    shippingTotal,
    receiptUrl,
    trackingCarrier,
    trackingNumber,
    trackingLink,
    orders,
  } = shipmentCard;
  const orderCount = orders.length;

  return (
    <div ref={cardRef}>
      <Card
        className={
          focused
            ? "ring-2 ring-success dark:ring-accent ring-offset-2 ring-offset-background"
            : ""
        }
      >
        <CardContent className="space-y-4">
          {/* Header — toggles the order list */}
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            className="w-full text-left cursor-pointer"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <Boxes className="size-5 shrink-0 text-blue-600" />
              <p className="font-bold text-lg">Shipment #{shipmentRef}</p>
              <Badge
                className={`text-xs font-medium flex items-center ${statusConfig.iconColor}`}
              >
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {createdAt} · {orderCount} order{orderCount === 1 ? "" : "s"} in
              one parcel
            </p>
          </button>

          {isOpen && (
            <div className="space-y-4">
              {/* Shipping receipt */}
              <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Flat shipping</span>
                  <span className="font-semibold">{shippingFee}</span>
                </div>
                {shippingInsurance && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Shipping Insurance (0.5%)
                    </span>
                    <span className="font-semibold">{shippingInsurance}</span>
                  </div>
                )}
                {trackingNumber && (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Tracking</span>
                    {trackingLink ? (
                      <a
                        href={trackingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-blue-600 hover:underline inline-flex items-center gap-1 truncate"
                      >
                        {trackingCarrier ? `${trackingCarrier} · ` : ""}
                        {trackingNumber}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="font-semibold truncate">
                        {trackingNumber}
                      </span>
                    )}
                  </div>
                )}
                {receiptUrl && (
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline pt-1"
                  >
                    View shipping receipt
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>

              {/* Orders in the parcel */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Orders in this shipment
                </p>
                <div className="divide-y rounded-md border">
                  {orders.map((order) => (
                    <Link
                      key={order.orderId}
                      to={order.detailUrl}
                      className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-muted/50"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold truncate">
                          Invoice #{order.ref}
                        </span>
                        <span className="block text-xs text-muted-foreground capitalize">
                          {order.createdAt} · {order.orderType}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-success dark:text-accent">
                          {order.totalAmount}
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border/70" />

          {/* Bottom Row */}
          <div className="flex items-center justify-between">
            <div className="leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Shipping paid
              </span>
              <span className="font-bold text-success dark:text-accent text-2xl">
                {shippingTotal}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen((open) => !open)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground"
            >
              {isOpen
                ? "Hide orders"
                : `View ${orderCount} order${orderCount === 1 ? "" : "s"}`}
              <ChevronDown
                className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShipmentCard;
