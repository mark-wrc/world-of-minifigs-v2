import React from "react";
import { useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import { useShippingPlan } from "@/hooks/useShippingPlan";
import { SHIPPING_MODES } from "@/redux/slices/shippingSlice";
import { resolveShippingCountry } from "@shared/shippingData";
import { formatCurrency } from "@/utils/formatting";

// Pay Now, Ship Later — choose whether this order ships now or waits to be
// shipped together with later orders for one flat fee.
const ShippingPlanSelect = ({ disabled = false, className = "" }) => {
  const country = useSelector((state) => state.shipping.country);
  const { mode, setMode, canHold } = useShippingPlan();

  const flatRate = formatCurrency(resolveShippingCountry(country).amount / 100);

  const options = [
    {
      value: SHIPPING_MODES.SHIP_NOW,
      label: "Ship now",
      description: `${flatRate} flat rate`,
    },
    {
      value: SHIPPING_MODES.HOLD,
      label: "Hold",
      description: "Ship later together",
      disabled: !canHold,
    },
  ];

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        When to ship
      </p>

      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="outline"
            onClick={() => setMode(option.value)}
            disabled={disabled || option.disabled}
            aria-pressed={mode === option.value}
            className={`h-auto flex-col gap-0 hover:bg-background hover:text-foreground dark:hover:bg-input/30 ${
              mode === option.value
                ? "border-foreground ring-1 ring-foreground"
                : "hover:border-foreground/40"
            }`}
          >
            <span className="text-sm font-semibold">{option.label}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {option.description}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default ShippingPlanSelect;
