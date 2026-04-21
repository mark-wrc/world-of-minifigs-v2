import React from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_SAFE_QTY = Number.MAX_SAFE_INTEGER;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const SIZES = {
  xs: {
    container: "h-7",
    button: "size-7 p-0",
    input: "w-10 text-xs",
    icon: "size-2",
  },
  sm: {
    container: "h-8",
    button: "size-8 p-0",
    input: "w-12 text-xs",
    icon: "size-3",
  },
  md: {
    container: "h-10",
    button: "size-10 p-0",
    input: "w-14 text-sm",
    icon: "size-4",
  },
  lg: {
    container: "h-12",
    button: "size-12 p-0",
    input: "w-16 text-sm",
    icon: "size-4",
  },
};

const QuantityControl = ({
  value,
  onChange,
  min = 1,
  max = Infinity,
  allowInput = false,
  disabled = false,
  className = "",
  size = "sm",
}) => {
  const safeMax = Number.isFinite(max)
    ? Math.min(max, MAX_SAFE_QTY)
    : MAX_SAFE_QTY;
  const numericValue = toNumber(value, 0);
  const config = SIZES[size] || SIZES.sm;

  const emitValue = (nextValue) => {
    if (!onChange) return;
    onChange(clamp(nextValue, min, safeMax));
  };

  const handleDecrement = () => emitValue(numericValue - 1);
  const handleIncrement = () => emitValue(numericValue + 1);

  const handleInputChange = (e) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange?.("");
      return;
    }

    if (/e|E|\+|\-/.test(raw)) return;
    if (!/^\d+$/.test(raw)) return;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      emitValue(safeMax);
      return;
    }

    emitValue(parsed);
  };

  const handleInputBlur = () => {
    if (!allowInput || !onChange) return;
    if (value === "" || Number.isNaN(Number(value))) {
      onChange(min);
      return;
    }
    emitValue(toNumber(value, min));
  };

  const commonBtnClass = `text-black hover:bg-transparent disabled:opacity-30 shrink-0 ${config.button}`;

  const ControlButton = ({ icon: Icon, onClick, disabled, label }) => (
    <Button
      variant="ghost"
      type="button"
      className={commonBtnClass}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <Icon className={config.icon} />
    </Button>
  );

  const centerClass = `text-center font-bold h-full w-full flex items-center justify-center ${config.input}`;

  return (
    <div
      className={`flex items-center border overflow-hidden ${config.container} ${className}`}
      role="group"
      aria-label="Quantity"
    >
      <ControlButton
        icon={Minus}
        onClick={handleDecrement}
        disabled={disabled || numericValue <= min}
        label="Decrease quantity"
      />

      <div className="flex-1 h-full flex items-center justify-center">
        {allowInput ? (
          <Input
            type="number"
            min={min}
            max={safeMax}
            value={value}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-", "."].includes(e.key)) {
                e.preventDefault();
              }
            }}
            readOnly={!onChange || disabled}
            disabled={disabled}
            className={`border-0 focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none p-0 text-center font-bold h-full w-full bg-transparent ${config.input}`}
            aria-label="Quantity input"
          />
        ) : (
          <span
            className={`text-center font-bold ${config.input}`}
            role="status"
            aria-live="polite"
          >
            {value}
          </span>
        )}
      </div>

      <ControlButton
        icon={Plus}
        onClick={handleIncrement}
        disabled={disabled || numericValue >= safeMax}
        label="Increase quantity"
      />
    </div>
  );
};

export default QuantityControl;
