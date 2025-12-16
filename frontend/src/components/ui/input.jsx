import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/components/ui/lib/utils";
import { Button } from "@/components/ui/button";

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [hasValue, setHasValue] = React.useState(false);
  const isPassword = type === "password";

  const inputType = isPassword && showPassword ? "text" : type;

  const handleFocus = (e) => {
    setIsFocused(true);
    props.onFocus?.(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    props.onBlur?.(e);
  };

  const handleChange = (e) => {
    setHasValue(e.target.value.length > 0);
    props.onChange?.(e);
  };

  const showEyeIcon = isPassword && (isFocused || hasValue);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={inputType}
        data-slot="input"
        className={cn(
          "file:text-accent-foreground placeholder:text-muted-foreground dark:placeholder:text-secondary-foreground/50 selection:bg-accent selection:text-foreground dark:selection:text-secondary-foreground dark:bg-foreground dark:text-secondary-foreground border-border/50 dark:border-input/30 h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 text-sm",
          "focus-visible:ring-accent focus-visible:ring-2",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          isPassword && "pr-10",
          className
        )}
        {...props}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
      />
      {showEyeIcon && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff className="size-4 text-muted-foreground" />
          ) : (
            <Eye className="size-4 text-muted-foreground" />
          )}
        </Button>
      )}
    </div>
  );
});

Input.displayName = "Input";

export { Input };
