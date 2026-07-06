import React from "react";
import { ChevronDown, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Internal helper for consistent form field layout
const FormContainer = ({
  label,
  name,
  labelRight,
  className = "",
  children,
}) => (
  <div className={`space-y-2 ${className}`}>
    {(label || labelRight) && (
      <div className="flex items-center justify-between">
        {label && <Label htmlFor={name}>{label}</Label>}
        {labelRight && labelRight}
      </div>
    )}
    {children}
  </div>
);

export const AdminFormInput = ({
  label,
  name,
  labelRight,
  className,
  inputClassName,
  ...props
}) => (
  <FormContainer
    label={label}
    name={name}
    labelRight={labelRight}
    className={className}
  >
    <Input id={name} name={name} className={inputClassName} {...props} />
  </FormContainer>
);

export const AdminFormTextarea = ({
  label,
  name,
  labelRight,
  className,
  textareaClassName,
  rows = 4,
  ...props
}) => (
  <FormContainer
    label={label}
    name={name}
    labelRight={labelRight}
    className={className}
  >
    <Textarea
      id={name}
      name={name}
      rows={rows}
      className={textareaClassName}
      {...props}
    />
  </FormContainer>
);

export const AdminFormMultiSelect = ({
  label,
  name,
  labelRight,
  value = [],
  onValueChange,
  options = [],
  getValue = (opt) => opt.value,
  getLabel = (opt) => opt.label,
  placeholder = "Select options",
  className = "",
  triggerClassName = "",
  disabled = false,
  isLoading = false,
  emptyMessage = "No options available",
}) => {
  const selected = Array.isArray(value) ? value : [];

  const toggle = (val) => {
    onValueChange(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val],
    );
  };

  const labelFor = (val) => {
    const opt = options.find((o) => getValue(o) === val);
    return opt ? getLabel(opt) : val;
  };

  return (
    <FormContainer
      label={label}
      name={name}
      labelRight={labelRight}
      className={className}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          id={name}
          disabled={disabled || isLoading}
          className={`flex h-8 w-full items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2 cursor-pointer ${triggerClassName}`}
        >
          <span className={selected.length ? "" : "text-muted-foreground"}>
            {isLoading
              ? "Loading..."
              : selected.length
                ? `${selected.length} selected`
                : placeholder}
          </span>
          <ChevronDown className="size-4 opacity-50 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {!isLoading && options.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}
          {options.map((option) => {
            const val = getValue(option);
            return (
              <DropdownMenuCheckboxItem
                key={val}
                checked={selected.includes(val)}
                onCheckedChange={() => toggle(val)}
                onSelect={(e) => e.preventDefault()}
              >
                {getLabel(option)}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {selected.map((val) => (
            <Badge key={val} variant="outline">
              {labelFor(val)}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggle(val)}
                  className="rounded-full cursor-pointer text-destructive"
                  aria-label={`Remove ${labelFor(val)}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </FormContainer>
  );
};

export const AdminFormSelect = ({
  label,
  name,
  labelRight,
  value,
  onValueChange,
  options = [],
  getValue = (opt) => opt.value,
  getLabel = (opt) => opt.label,
  placeholder = "Select an option",
  className = "",
  triggerClassName = "",
  disabled = false,
  isLoading = false,
  emptyMessage = "No options available",
  renderOption,
  ...props
}) => (
  <FormContainer
    label={label}
    name={name}
    labelRight={labelRight}
    className={className}
  >
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled || isLoading}
      name={name}
      {...props}
    >
      <SelectTrigger id={name} className={`w-full ${triggerClassName}`}>
        <SelectValue placeholder={isLoading ? "Loading..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {isLoading && (
          <div className="p-2 text-sm text-muted-foreground">Loading...</div>
        )}

        {!isLoading && options.length === 0 && (
          <div className="p-2 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}

        {!isLoading &&
          options.map((option) => (
            <SelectItem key={getValue(option)} value={getValue(option)}>
              {renderOption?.(option) ?? getLabel(option)}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  </FormContainer>
);
