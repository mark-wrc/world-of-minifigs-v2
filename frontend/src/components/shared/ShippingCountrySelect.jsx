import React from "react";
import { useDispatch, useSelector } from "react-redux";
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
    <div className={`space-y-2 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Ship to
      </p>

      <Select
        value={selected.code}
        onValueChange={(value) => dispatch(setShippingCountry(value))}
        disabled={disabled}
      >
        <SelectTrigger className="w-full data-[size=default]:h-11">
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

      <p className="text-xs text-muted-foreground">
        Shipping and tax are calculated for this destination on the next step.
      </p>
    </div>
  );
};

export default ShippingCountrySelect;
