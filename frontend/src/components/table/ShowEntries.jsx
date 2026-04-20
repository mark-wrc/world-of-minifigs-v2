import React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { entryOptions } from "@/constant/entryTableData";

const ShowEntries = ({ value, onValueChange, defaultValue = "50" }) => {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="entryOptions">Show</Label>
      <Select
        value={value}
        onValueChange={onValueChange}
        defaultValue={defaultValue}
      >
        <SelectTrigger id="entryOptions">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="w-24">
          {entryOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor="entryOptions">entries</Label>
    </div>
  );
};

export default ShowEntries;
