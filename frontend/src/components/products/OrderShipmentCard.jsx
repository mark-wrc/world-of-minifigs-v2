import React from "react";
import { Link } from "react-router-dom";
import { Archive, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getOrderRef,
  getOrderStatusConfig,
  getShipmentRef,
} from "@/constant/orderData";

// Pay Now, Ship Later on the order page: a held order points the customer to
// "Ship all now"; an order in a consolidated shipment lists what it ships with.
const OrderShipmentCard = ({ order, isHeld, shipment }) => {
  if (isHeld) {
    return (
      <Card className="border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20">
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Archive className="size-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Held — awaiting your ship request</p>
              <p className="text-sm text-muted-foreground">
                This order stays with us until you ask us to ship it. Ship all
                your held orders together for one flat shipping fee.
              </p>
            </div>
          </div>
          <Button asChild variant="dark" className="uppercase font-bold">
            <Link to="/purchase">Ship my held orders</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const orders = shipment?.orders || [];
  if (orders.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 text-success font-bold uppercase text-sm tracking-widest pb-4 border-b border-dashed">
          <Boxes className="size-4" />
          Shipment #{getShipmentRef(shipment)} · {orders.length} order
          {orders.length === 1 ? "" : "s"}
        </div>
        <div className="space-y-2">
          {orders.map((o) => {
            // The order being viewed — marked by a dashed success border.
            const isCurrent = o._id === order?._id;
            const status = getOrderStatusConfig(o);
            return (
              <Link
                key={o._id}
                to={`/checkout/success?order_id=${o._id}`}
                aria-current={isCurrent ? "page" : undefined}
                className={`flex items-center justify-between gap-3 rounded-lg p-3 text-sm hover:bg-muted/50 ${
                  isCurrent
                    ? "border-2 border-dashed border-success dark:border-accent bg-success/5 dark:bg-accent/5"
                    : "border"
                }`}
              >
                <span className="font-semibold">
                  Invoice #{getOrderRef(o)}
                  <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">
                    {o.orderType}
                  </span>
                </span>
                <span className="text-xs font-medium">{status.label}</span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderShipmentCard;
