import React from "react";
import { Button } from "@/components/ui/button";
import CommonImage from "@/components/shared/CommonImage";
import QuantityControl from "@/components/shared/QuantityControl";
import { splitProductItemName } from "@/constant/orderData";
import { perBagUnit } from "@shared/inventoryData";

// An order's lines (from getOrderLines) laid out the way the order view lists
// them: the same section cards, bundle / add-on names as group headings, and
// each item with its image (where it has one), name and a bin · colour row.
// Each line gets a quantity picker. Used by the Backorder Items and Refund
// windows.

// The order view's item sections, by line key (see shared/orderLines.js):
// p = product items, b/t = bundles and their torso bags, a = add-ons and their
// bags, x = extra bags.
const SECTIONS = [
  { id: "items", title: "Items", prefixes: ["p"] },
  { id: "bundles", title: "Selected Bundles", prefixes: ["b", "t"] },
  { id: "addons", title: "Add-on Selections", prefixes: ["a"] },
  { id: "extras", title: "Extra Bags", prefixes: ["x"] },
];

// Lines → sections → groups (a bundle or add-on name; none for loose lines),
// keeping the order's own order.
const groupLinesBySection = (lines) =>
  SECTIONS.map((section) => {
    const groups = [];
    for (const line of lines) {
      if (!section.prefixes.includes(line.key[0])) continue;
      const name = line.group || "";
      let group = groups.find((g) => g.name === name);
      if (!group) groups.push((group = { name, lines: [] }));
      group.lines.push(line);
    }
    return { ...section, groups };
  }).filter((section) => section.groups.length > 0);

// How the order view names a line: the name on the first row (add-on bags
// with their pieces per bag), then bin and colour on the second row.
const getLineDisplay = (order, line) => {
  const product = /^p(\d+)$/.exec(line.key);
  if (product) {
    const { name, colorName } = splitProductItemName(
      order?.productItems?.[product[1]],
    );
    return { name: name || line.name, meta: [colorName] };
  }
  const addonBag = /^a(\d+)s(\d+)$/.exec(line.key);
  const sub =
    addonBag &&
    order?.dealerItems?.addons?.[addonBag[1]]?.subItems?.[addonBag[2]];
  if (sub) {
    return {
      name: sub.name || line.name,
      piecesPerBag: sub.piecesPerBag,
      piecesUnit:
        sub.piecesPerBag != null && perBagUnit(sub.category, sub.piecesPerBag),
      meta: [sub.bin, sub.colorName],
    };
  }
  return { name: line.name, meta: [] };
};

// −/+ quantity (or type a number) from 0 to max, with an "All" button.
const LineQuantity = ({ value, max, onChange, disabled }) => (
  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
    <QuantityControl
      value={value}
      min={0}
      max={max}
      allowInput
      disabled={disabled || max === 0}
      onChange={onChange}
      className="rounded-md bg-background"
    />
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 px-3 shadow-none"
      title={`All ${max}`}
      disabled={disabled || max === 0 || Number(value) === max}
      onClick={() => onChange(max)}
    >
      All
    </Button>
  </div>
);

const OrderLineRow = ({ order, line, extraMeta = [], children }) => {
  const display = getLineDisplay(order, line);
  const meta = display.meta.filter(Boolean);
  const extra = extraMeta.filter(Boolean);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {line.imageUrl && (
          <CommonImage
            src={line.imageUrl}
            alt={display.name}
            thumb={128}
            className="w-16 shrink-0"
          />
        )}
        <div className="min-w-0 space-y-2 text-xs">
          <p className="font-semibold truncate">
            {display.name}
            {display.piecesPerBag != null && (
              <span className="font-normal">
                {" - "}
                <span className="font-bold text-red-600 dark:text-red-500">
                  {display.piecesPerBag}
                </span>{" "}
                {display.piecesUnit}
              </span>
            )}
          </p>
          {(meta.length > 0 || extra.length > 0) && (
            <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
              {[...meta, ...extra].map((detail, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span>·</span>}
                  <span>{detail}</span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
};

/**
 * @param order      the order the lines belong to (for names, colours, bins)
 * @param lines      the lines to show (already filtered by any search)
 * @param query      the search text, for the "no items match" message
 * @param values     { [lineKey]: quantity }
 * @param onChange   (lineKey, quantity) => void
 * @param getMax     line => the most that can be picked (default: its quantity)
 * @param getExtraMeta line => more strings for the second row (optional)
 * @param disabled   disables every picker
 */
const OrderLineList = ({
  order,
  lines,
  query,
  values,
  onChange,
  getMax = (line) => line.quantity,
  getExtraMeta,
  disabled,
  className = "max-h-[50vh]",
}) => (
  <div className={`space-y-2 overflow-y-auto ${className}`}>
    {lines.length === 0 && (
      <p className="p-3 text-xs text-muted-foreground">
        {query ? `No items match "${query}".` : "No items."}
      </p>
    )}
    {groupLinesBySection(lines).map((section) => (
      <div key={section.id} className="rounded-lg border">
        {/* Same section headers as the order view */}
        <div className="p-3 border-b font-semibold text-xs bg-success/20 rounded-t-md">
          {section.title}
        </div>
        <div className="divide-y">
          {section.groups.map((group) => (
            <div key={group.name || "_"}>
              {group.name && (
                <p className="px-3 pt-3 text-sm font-medium">{group.name}</p>
              )}
              <div className="divide-y">
                {group.lines.map((line) => (
                  <OrderLineRow
                    key={line.key}
                    order={order}
                    line={line}
                    extraMeta={getExtraMeta?.(line)}
                  >
                    <LineQuantity
                      value={values[line.key] ?? 0}
                      max={getMax(line)}
                      disabled={disabled}
                      onChange={(v) => onChange(line.key, v)}
                    />
                  </OrderLineRow>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default OrderLineList;
