import React, { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useShippingPlan } from "@/hooks/useShippingPlan";
import { formatCurrency } from "@/utils/formatting";
import { computeShippingInsurance } from "@shared/shippingData";

/**
 * Optional 0.5% shipping insurance, offered on every order type. It's charged
 * with the shipping it protects:
 * - "Hold & ship later": nothing now — offered once the held orders ship.
 * - "Ship all now" (`forHeldShipment`): 0.5% of every held order.
 *
 * `itemsSubtotal` is this checkout's items (ignored for `forHeldShipment`).
 * Uncontrolled, it uses the shared checkout choice that useCheckout sends;
 * dealer / wholesale pages pass `checked` + `onCheckedChange` for their own.
 */
const ShippingInsuranceOption = ({
  itemsSubtotal = 0,
  checked: checkedProp,
  onCheckedChange: onCheckedChangeProp,
  forHeldShipment = false,
  disabled = false,
  className = "",
}) => {
  const id = useId();
  const {
    isHold,
    heldOrdersSubtotal,
    insurance,
    setInsurance,
  } = useShippingPlan();
  const checked = checkedProp ?? insurance;
  const onCheckedChange = onCheckedChangeProp ?? setInsurance;

  // Held checkouts pay no insurance — it's offered when the parcel ships.
  if (isHold && !forHeldShipment) return null;

  const base = forHeldShipment
    ? heldOrdersSubtotal
    : itemsSubtotal;
  const amount = computeShippingInsurance(base);

  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange?.(value === true)}
          disabled={disabled}
          className="mt-0.5"
        />
        <Label
          htmlFor={id}
          className="cursor-pointer flex flex-col items-start gap-0.5"
        >
          <span className="text-sm font-bold">Shipping Insurance</span>
          <span className="text-xs text-muted-foreground font-medium leading-snug">
            Protect your order against loss, theft, or damage during shipping.
          </span>
        </Label>
      </div>
      <span className="text-sm font-bold text-success dark:text-accent shrink-0">
        {formatCurrency(amount)}
      </span>
    </div>
  );
};

export default ShippingInsuranceOption;
