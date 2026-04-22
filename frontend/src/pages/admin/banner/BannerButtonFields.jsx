import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AdminFormSelect } from "@/components/shared/AdminFormInput";

const BannerButtonFields = ({
  formData,
  isSubmitting,
  handleValueChange,
  handleNestedChange,
}) => {
  return (
    <div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="enableButtons"
          name="enableButtons"
          checked={formData.enableButtons}
          onCheckedChange={handleValueChange("enableButtons")}
          disabled={isSubmitting}
        />
        <Label htmlFor="enableButtons" className="mt-0.5">
          Enable Redirect Buttons{" "}
          <span className="text-xs font-normal opacity-70">(Optional)</span>
        </Label>
      </div>

      {formData.enableButtons && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {formData.buttons.map((btn, i) => (
            <div key={i} className="space-y-4 border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Button {i + 1}{" "}
                  {i === 1 && (
                    <span className="opacity-70 font-normal">(Optional)</span>
                  )}
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`btn-label-${i}`}>Button Label</Label>
                <Input
                  id={`btn-label-${i}`}
                  name={`btn-label-${i}`}
                  placeholder="e.g. Shop Now"
                  value={btn.label}
                  onChange={handleNestedChange("buttons", i, "label")}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`btn-href-${i}`}>Link URL</Label>
                <Input
                  id={`btn-href-${i}`}
                  name={`btn-href-${i}`}
                  placeholder="/products, /collections, /register..."
                  value={btn.href}
                  onChange={handleNestedChange("buttons", i, "href")}
                  disabled={isSubmitting}
                />
              </div>

              <AdminFormSelect
                label="Visual Style"
                name={`btn-variant-${i}`}
                value={btn.variant || "default"}
                onValueChange={handleNestedChange("buttons", i, "variant")}
                options={[
                  { value: "default", label: "Solid Button" },
                  { value: "outline", label: "Outline Button" },
                ]}
                placeholder="Select style"
                disabled={isSubmitting}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BannerButtonFields;
