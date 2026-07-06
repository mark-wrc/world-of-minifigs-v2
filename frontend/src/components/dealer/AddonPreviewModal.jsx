import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import CommonImage from "@/components/shared/CommonImage";
import QuantityControl from "@/components/shared/QuantityControl";
import ProductSort from "@/components/products/ProductSort";
import { SORT_OPTIONS } from "@/constant/productFilters";
import { BULK_MINIFIG_PART_TYPES, perBagUnit } from "@shared/inventoryData";
import { formatCurrency } from "@/utils/formatting";

const ADDON_SORT_OPTIONS = SORT_OPTIONS.filter(
  (o) => !o.value.startsWith("date"),
);

const AddonPreviewModal = ({
  addon,
  items,
  totalPrice,
  canSubmit,
  isUpdate,
  onClose,
  onConfirm,
  onValueChange,
}) => {
  const [sortBy, setSortBy] = useState("name_asc");
  const [selectedCollection, setSelectedCollection] = useState(null);

  const isMinifigs =
    items.length > 0 && items.every((i) => i.category === "minifigs");

  const isBulkParts =
    items.length > 0 &&
    items.every((i) => i.category === "bulk-minifig-parts");

  const collections = useMemo(() => {
    if (!isMinifigs) return [];
    const map = new Map();
    for (const item of items) {
      // A minifig can belong to several collections — count it under each.
      // Items without any collection are skipped (no "Uncategorized" filter).
      for (const col of item.collectionIds || []) {
        const id = col?._id || col;
        if (!id) continue;
        const name = col?.collectionName || id;
        if (!map.has(id)) map.set(id, { id, name, count: 0 });
        map.get(id).count += 1;
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [isMinifigs, items]);

  // For bulk-minifig-parts the "collection" is a fixed part-type string.
  // Show every fixed type, sorted in the original enum order, but only enable
  // the ones present in this addon.
  const partTypes = useMemo(() => {
    if (!isBulkParts) return [];
    const counts = new Map();
    for (const item of items) {
      const t = item.partType || "__none__";
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    const ordered = BULK_MINIFIG_PART_TYPES.filter((name) =>
      counts.has(name),
    ).map((name) => ({ id: name, name, count: counts.get(name) }));
    if (counts.has("__none__")) {
      ordered.push({
        id: "__none__",
        name: "Uncategorized",
        count: counts.get("__none__"),
      });
    }
    return ordered;
  }, [isBulkParts, items]);

  const sortedItems = useMemo(() => {
    const filtered = selectedCollection
      ? items.filter((i) => {
          if (isBulkParts) {
            const t = i.partType || "__none__";
            return t === selectedCollection;
          }
          const ids = i.collectionIds?.length
            ? i.collectionIds.map((c) => c?._id || c)
            : ["__none__"];
          return ids.includes(selectedCollection);
        })
      : items;

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name_asc":
          return a.itemName.localeCompare(b.itemName);
        case "name_desc":
          return b.itemName.localeCompare(a.itemName);
        case "price_asc":
          return a.bagPrice - b.bagPrice;
        case "price_desc":
          return b.bagPrice - a.bagPrice;
        default:
          return 0;
      }
    });
  }, [items, sortBy, selectedCollection, isBulkParts]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl overflow-hidden flex flex-col gap-0">
        <DialogHeader>
          <DialogTitle className="text-xl">{addon.addonName}</DialogTitle>
          <DialogDescription className="sr-only">
            {addon.addonName} items
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 px-1 pb-3">
          <div className="flex items-center gap-2">
            {isMinifigs && collections.length > 1 && (
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="addon-collection-select"
                  className="hidden sm:block whitespace-nowrap text-sm"
                >
                  Filter by:
                </Label>
                <Select
                  value={selectedCollection ?? "all"}
                  onValueChange={(v) =>
                    setSelectedCollection(v === "all" ? null : v)
                  }
                >
                  <SelectTrigger id="addon-collection-select">
                    <SelectValue placeholder="All Collections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Collections</SelectItem>
                    {collections.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isBulkParts && partTypes.length > 1 && (
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="addon-parttype-select"
                  className="hidden sm:block whitespace-nowrap text-sm"
                >
                  Filter by:
                </Label>
                <Select
                  value={selectedCollection ?? "all"}
                  onValueChange={(v) =>
                    setSelectedCollection(v === "all" ? null : v)
                  }
                >
                  <SelectTrigger id="addon-parttype-select">
                    <SelectValue placeholder="All Part Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Part Types</SelectItem>
                    {partTypes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <ProductSort
              sortBy={sortBy}
              onSortChange={setSortBy}
              options={ADDON_SORT_OPTIONS}
              id="addon-sort-select"
              labelClassName="hidden sm:block"
            />
          </div>
          <div className="font-bold text-sm ml-auto">
            <span className="hidden sm:inline">Total: </span>
            <span className="text-success dark:text-accent">
              {formatCurrency(totalPrice)}
            </span>
          </div>
        </div>


        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1">
            {sortedItems.map((item) => (
              <div
                key={item.key}
                className={`relative rounded-md border p-2 transition-all duration-300 ${
                  item.isActive ? "border-accent border-l-4" : "border"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Image with hover preview */}
                  <HoverCard openDelay={150} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      <div className="shrink-0 cursor-zoom-in">
                        <CommonImage
                          src={item.image?.url}
                          alt={item.itemName}
                          className="w-24"
                        />
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent>
                      <CommonImage
                        src={item.image?.url}
                        alt={item.itemName}
                        className="w-80"
                      />
                    </HoverCardContent>
                  </HoverCard>

                  {/* Right Content */}
                  <div className="flex flex-col gap-2 flex-1">
                    {/* Name + Total */}
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className="text-sm font-semibold line-clamp-1 leading-tight min-w-0"
                        title={`${item.itemName} - ${item.perBagLimit} ${perBagUnit(item.category, item.perBagLimit)}`}
                      >
                        {item.itemName}{" "}
                        <span className="text-xs font-normal">
                          -{" "}
                          <span className="font-bold text-red-600 dark:text-red-500">
                            {item.perBagLimit}
                          </span>{" "}
                          {perBagUnit(item.category, item.perBagLimit)}
                        </span>
                      </h4>

                      {item.selectedTotal > 0 && (
                        <span className="font-bold text-sm text-success dark:text-accent whitespace-nowrap">
                          {formatCurrency(item.selectedTotal)}
                        </span>
                      )}
                    </div>

                    {/* Info Row */}
                    <span className="text-xs text-muted-foreground">
                      {item.color?.colorName || "—"} {" · "}
                      <span className="font-semibold text-success dark:text-accent">
                        {formatCurrency(item.bagPrice)}
                      </span>
                    </span>

                    {/* Quantity Control */}
                    <div className="mt-2 flex items-center">
                      <QuantityControl
                        value={item.selectedBags}
                        onChange={(val) =>
                          onValueChange(item.inventoryItemId, val)
                        }
                        min={0}
                        max={item.maxBags}
                        size="xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" disabled={!canSubmit} onClick={onConfirm}>
            {isUpdate ? "Update Order" : "Add to Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddonPreviewModal;
