import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SORT_OPTIONS } from "@/constant/productFilters";

const ProductSort = ({
  sortBy,
  onSortChange,
  id = "sort-select",
  className = "",
  showLabel = true,
  labelText = "Sort by:",
  labelClassName = "",
  variant = "default", // "default" | "mobile"
  options = SORT_OPTIONS,
}) => {
  const isMobile = variant === "mobile";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <Label
          htmlFor={id}
          className={`${isMobile ? "text-sm whitespace-nowrap" : ""} ${labelClassName}`}
        >
          {labelText}
        </Label>
      )}
      <Select value={sortBy} onValueChange={onSortChange}>
        <SelectTrigger id={id} className={isMobile ? "flex-1" : ""}>
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ProductSort;
