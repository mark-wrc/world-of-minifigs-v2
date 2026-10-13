import React from "react";
import { Button } from "@/components/ui/button";
import { usePaymentGateway } from "@/hooks/usePaymentGateway";

// Listed in display order — Square first.
const GATEWAY_LABELS = {
  square: "Square",
  stripe: "Stripe",
};

const PaymentMethodSelect = ({ disabled = false, className = "" }) => {
  const { gateway, gateways, setGateway } = usePaymentGateway();

  // Only one gateway on offer — nothing to choose.
  const options = Object.keys(GATEWAY_LABELS).filter((value) =>
    gateways.includes(value),
  );
  if (options.length < 2) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Pay with
      </p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((value) => (
          <Button
            key={value}
            type="button"
            variant="outline"
            onClick={() => setGateway(value)}
            disabled={disabled}
            aria-pressed={gateway === value}
            className={`h-11 font-semibold hover:bg-background hover:text-foreground dark:hover:bg-input/30 ${
              gateway === value
                ? "border-foreground ring-1 ring-foreground"
                : "hover:border-foreground/40"
            }`}
          >
            {GATEWAY_LABELS[value]}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Cards and promo codes accepted.
      </p>
    </div>
  );
};

export default PaymentMethodSelect;
