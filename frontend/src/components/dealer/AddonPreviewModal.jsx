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
import { Badge } from "@/components/ui/badge";
import CommonImage from "@/components/shared/CommonImage";
import QuantityControl from "@/components/shared/QuantityControl";
import ProductSort from "@/components/products/ProductSort";
import { SORT_OPTIONS } from "@/constant/productFilters";
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

  const collections = useMemo(() => {
    if (!isMinifigs) return [];
    const map = new Map();
    for (const item of items) {
      const id = item.collectionId?._id || item.collectionId || "__none__";
      const name = item.collectionId?.collectionName || "Uncategorized";
      if (!map.has(id)) map.set(id, { id, name, count: 0 });
      map.get(id).count += 1;
    }
    return [...map.values()].sort((a, b) => {
      if (a.id === "__none__") return 1;
      if (b.id === "__none__") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [isMinifigs, items]);

  const sortedItems = useMemo(() => {
    const filtered = selectedCollection
      ? items.filter((i) => {
          const id = i.collectionId?._id || i.collectionId || "__none__";
          return id === selectedCollection;
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
  }, [items, sortBy, selectedCollection]);

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
                } ${item.isOutOfStock ? "opacity-60 grayscale-[0.5]" : ""}`}
              >
                {/* Out of Stock Badge */}
                {item.isOutOfStock && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge
                      variant="destructive"
                      className="uppercase text-[10px] px-1.5 py-0"
                    >
                      Out of Stock
                    </Badge>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {/* Image */}
                  <CommonImage
                    src={item.image?.url}
                    alt={item.itemName}
                    className="w-24 aspect-4/3"
                  />

                  {/* Right Content */}
                  <div className="flex flex-col gap-2 flex-1">
                    {/* Name + Total */}
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className="text-sm font-semibold line-clamp-1 leading-tight min-w-0"
                        title={`${item.itemName} - ${item.perBagLimit === 1 ? "1 minifig" : `${item.perBagLimit} pcs/bag`}`}
                      >
                        {item.itemName}{" "}
                        <span className="text-xs font-normal">
                          -{" "}
                          {item.perBagLimit === 1
                            ? "1 minifig"
                            : `${item.perBagLimit} pcs/bag`}
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
                        disabled={item.isOutOfStock}
                        allowInput={!item.isOutOfStock}
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
