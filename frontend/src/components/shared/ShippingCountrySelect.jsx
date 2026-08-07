import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Truck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setShippingCountry } from "@/redux/slices/shippingSlice";
import {
  SHIPPING_COUNTRIES,
  resolveShippingCountry,
} from "@shared/shippingData";

const ShippingCountrySelect = ({ disabled = false, className = "" }) => {
  const dispatch = useDispatch();
  const country = useSelector((state) => state.shipping.country);
  const selected = resolveShippingCountry(country);

  return (
    <div
      className={`rounded-lg border-2 border-dashed border-success/50 dark:border-accent/50 bg-success/5 dark:bg-accent/5 p-3 space-y-2 ${className}`}
    >
      <div className="flex items-center gap-2">
        <Truck className="size-4 shrink-0 text-success dark:text-accent" />
        <span className="text-sm font-extrabold uppercase tracking-wide">
          Shipping Destination
        </span>
      </div>

      <Select
        value={selected.code}
        onValueChange={(value) => dispatch(setShippingCountry(value))}
        disabled={disabled}
      >
        <SelectTrigger className="w-full data-[size=default]:h-11 bg-background font-bold">
          <SelectValue placeholder="Select destination" />
        </SelectTrigger>
        <SelectContent>
          {SHIPPING_COUNTRIES.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <p className="text-xs text-muted-foreground leading-snug">
        Shipping and tax are calculated for this destination on the next step.
      </p>
    </div>
  );
};

export default ShippingCountrySelect;
