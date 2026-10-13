import React from "react";
import { Link } from "react-router-dom";
import { PiggyBank, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CheckoutButton } from "@/components/shared/OrderActionButton";
import PaymentMethodSelect from "@/components/shared/PaymentMethodSelect";
import ShippingInsuranceOption from "@/components/shared/ShippingInsuranceOption";
import useShipHeldOrders from "@/hooks/useShipHeldOrders";
import { getOrderRef } from "@/constant/orderData";

const formatHeldDate = (date) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// Pay Now, Ship Later — everything the customer has held, and one button to
// ship it all for a single flat fee.
const HeldOrdersPanel = () => {
  const {
    count,
    orders,
    hasHeldOrders,
    mixedCountries,
    shippingRate,
    insuranceAmount,
    shipTotal,
    shippingSaved,
    shipAll,
    isShipping,
  } = useShipHeldOrders();

  if (!hasHeldOrders) return null;

  return (
    <Card className="mb-5 p-0 gap-0 overflow-hidden grid grid-cols-1 md:grid-cols-[3fr_2fr]">
      {/* Left: what's waiting */}
      <div className="p-6 space-y-5 flex flex-col justify-center">
        <div className="space-y-3">
          <span className="inline-block rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
            Ready to ship
          </span>

          <h2 className="text-2xl font-extrabold tracking-tight">
            {count} order{count === 1 ? " is" : "s are"} waiting for you
          </h2>
          {mixedCountries && (
            <p className="text-sm text-muted-foreground">
              Your held orders go to different countries, so they can't share
              one parcel. Please contact support to arrange shipping.
            </p>
          )}
          {/* What bundling the parcel saves vs shipping each order alone */}
          {!mixedCountries && shippingSaved && (
            <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-success to-success/80 dark:from-accent dark:to-accent/80 text-white dark:text-secondary-foreground p-4">
              <PiggyBank className="absolute -right-3 -bottom-4 size-20 opacity-15 rotate-12" />
              <div className="relative flex items-center gap-3">
                <div className="size-9 shrink-0 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="size-4" />
                </div>
                <div className="leading-tight">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">
                    Ship together &amp; save
                  </p>
                  <p className="text-xl font-extrabold">
                    {shippingSaved} off shipping
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lines only between orders — none above the first or below the last */}
        <div className="divide-y mt-5">
          {orders.map((order) => (
            <div key={order._id} className="py-5 first:pt-0 last:pb-0">
              <Link
                to={`/checkout/success?order_id=${order._id}`}
                className="block text-lg font-bold truncate text-success hover:underline underline-offset-4"
              >
                Invoice #{getOrderRef(order)}
              </Link>
              <p className="text-sm text-muted-foreground capitalize">
                {formatHeldDate(order.createdAt)} · {order.orderType}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Right: how to pay for the parcel */}
      {!mixedCountries && (
        <div className="p-6 space-y-5 flex flex-col justify-center bg-muted/50 border-t md:border-t-0 md:border-l">
          <PaymentMethodSelect disabled={isShipping} />

          <ShippingInsuranceOption
            forHeldShipment
            disabled={isShipping}
            className="pb-4 border-b border-dashed"
          />

          {/* Breakdown — insurance line only once it's ticked */}
          <div className="space-y-2 pb-4 border-b border-dashed text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{shippingRate}</span>
            </div>
            {insuranceAmount && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Shipping Insurance (0.5%)
                </span>
                <span className="font-semibold">{insuranceAmount}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-bold uppercase text-muted-foreground">
              Total Amount
            </span>
            <p className="text-3xl font-black text-success dark:text-accent">
              {shipTotal}
            </p>
          </div>

          <CheckoutButton
            label="Ship all now"
            onClick={shipAll}
            isLoading={isShipping}
            className="h-12"
          />
        </div>
      )}
    </Card>
  );
};

export default HeldOrdersPanel;
