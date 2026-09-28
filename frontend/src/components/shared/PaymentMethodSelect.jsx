import React, { useId } from "react";
import { CreditCard } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePaymentGateway } from "@/hooks/usePaymentGateway";

const GATEWAY_OPTIONS = {
  stripe: { label: "Stripe", description: "Card & promo codes" },
  square: { label: "Square", description: "Card" },
};

const PaymentMethodSelect = ({ disabled = false, className = "" }) => {
  const idPrefix = useId();
  const { gateway, gateways, setGateway } = usePaymentGateway();

  // Only one gateway on offer — nothing to choose.
  const options = gateways.filter((value) => GATEWAY_OPTIONS[value]);
  if (options.length < 2) return null;

  return (
    <div
      className={`rounded-lg border-2 border-dashed border-success/50 dark:border-accent/50 bg-success/5 dark:bg-accent/5 p-3 space-y-2 ${className}`}
    >
      <div className="flex items-center gap-2">
        <CreditCard className="size-4 shrink-0 text-success dark:text-accent" />
        <span className="text-sm font-extrabold uppercase tracking-wide">
          Payment Method
        </span>
      </div>

      <RadioGroup
        value={gateway}
        onValueChange={setGateway}
        disabled={disabled}
        className="grid-cols-2 gap-2"
      >
        {options.map((value) => {
          const id = `${idPrefix}-${value}`;
          return (
            <label
              key={value}
              htmlFor={id}
              className="flex items-center gap-2 rounded-md border-2 bg-background px-3 py-2 cursor-pointer has-[[data-state=checked]]:border-success dark:has-[[data-state=checked]]:border-accent"
            >
              <RadioGroupItem value={value} id={id} />
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-bold">
                  {GATEWAY_OPTIONS[value].label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {GATEWAY_OPTIONS[value].description}
                </span>
              </span>
            </label>
          );
        })}
      </RadioGroup>

      {gateway === "square" && (
        <p className="text-xs text-muted-foreground leading-snug">
          Promo codes can only be applied when paying with Stripe.
        </p>
      )}
    </div>
  );
};

export default PaymentMethodSelect;
