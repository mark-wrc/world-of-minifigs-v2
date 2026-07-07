import { useState, useMemo } from "react";
import { toast } from "sonner";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { useReorderDealerAddonItemsMutation } from "@/redux/api/adminApi";

// "Featured" is the admin-curated order stored on the add-on (the bundleItems
// array order). It's the default so dealers first see whatever the admin put up
// top. The remaining name/price options are for dealers who want to re-browse.
const ADDON_SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  ...SORT_OPTIONS.filter((o) => !o.value.startsWith("date")),
];

// ─── Item card (shared by the static and draggable variants) ──────────────────
const AddonItemCard = ({
  item,
  onValueChange,
  reorderable = false,
  containerRef,
  style,
  attributes = {},
  dragListeners = {},
  isDragging = false,
}) => (
  <div
    ref={containerRef}
    style={style}
    {...attributes}
    {...(reorderable ? dragListeners : {})}
    title={reorderable ? "Drag to reorder" : undefined}
    className={`group relative rounded-md border p-2 transition-all duration-300 ${
      item.isActive ? "border-accent border-l-4" : "border"
    } ${isDragging ? "ring-2 ring-accent shadow-lg" : ""} ${
      reorderable ? "cursor-grab active:cursor-grabbing" : ""
    }`}
  >
    {/* Drag affordance — overlaid top-left, revealed on hover (admin only).
        Absolutely positioned so it never reserves layout space. */}
    {reorderable && (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-2 left-2 z-10 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        <GripVertical className="size-4" />
      </span>
    )}

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
            onChange={(val) => onValueChange(item.inventoryItemId, val)}
            min={0}
            max={item.maxBags}
            size="xs"
          />
        </div>
      </div>
    </div>
  </div>
);

// ─── Draggable wrapper — one sortable item keyed by inventory id ──────────────
const SortableAddonItem = ({ item, onValueChange }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.inventoryItemId });

  return (
    <AddonItemCard
      item={item}
      onValueChange={onValueChange}
      reorderable
      containerRef={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 1,
      }}
      attributes={attributes}
      dragListeners={listeners}
      isDragging={isDragging}
    />
  );
};

const AddonPreviewModal = ({
  addon,
  items,
  totalPrice,
  canSubmit,
  isUpdate,
  isAdmin = false,
  onClose,
  onConfirm,
  onValueChange,
}) => {
  const [sortBy, setSortBy] = useState("featured");
  const [selectedCollection, setSelectedCollection] = useState(null);

  const isMinifigs =
    items.length > 0 && items.every((i) => i.category === "minifigs");

  const isBulkParts =
    items.length > 0 &&
    items.every((i) => i.category === "bulk-minifig-parts");

  // ─── Admin reorder state ────────────────────────────────────────────────────
  // `orderIds` is the admin's in-progress custom order (list of inventory ids).
  // null = untouched → fall back to the stored (featured) order. Keyed by id so
  // it survives quantity edits that recompute `items`.
  const [orderIds, setOrderIds] = useState(null);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);
  const [reorderAddonItems, { isLoading: isSavingOrder }] =
    useReorderDealerAddonItemsMutation();

  // Reset any pending reorder when the modal switches to a different add-on.
  // Adjusting state during render (React's endorsed pattern) instead of an
  // effect avoids an extra render pass.
  const [prevAddonId, setPrevAddonId] = useState(addon?._id);
  if (addon?._id !== prevAddonId) {
    setPrevAddonId(addon?._id);
    setOrderIds(null);
    setHasOrderChanges(false);
  }

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

  // The stored (featured) order — position of each item in the add-on's
  // bundleItems array. Used both to render the default order and as the base
  // the admin drags against.
  const featuredItems = useMemo(() => {
    const rank = new Map();
    (addon.bundleItems || []).forEach((bi, idx) => {
      const id = String(bi.inventoryItemId?._id || bi.inventoryItemId || "");
      if (id) rank.set(id, idx);
    });
    const base = [...items].sort(
      (a, b) =>
        (rank.get(a.inventoryItemId) ?? 0) - (rank.get(b.inventoryItemId) ?? 0),
    );

    if (!orderIds) return base;

    // Apply the admin's in-progress custom order, appending any items not yet
    // placed (e.g. freshly added) in their featured order.
    const byId = new Map(base.map((i) => [i.inventoryItemId, i]));
    const ordered = [];
    for (const id of orderIds) {
      if (byId.has(id)) {
        ordered.push(byId.get(id));
        byId.delete(id);
      }
    }
    for (const i of base) {
      if (byId.has(i.inventoryItemId)) ordered.push(i);
    }
    return ordered;
  }, [addon.bundleItems, items, orderIds]);

  const sortedItems = useMemo(() => {
    const filtered = selectedCollection
      ? featuredItems.filter((i) => {
          if (isBulkParts) {
            const t = i.partType || "__none__";
            return t === selectedCollection;
          }
          const ids = i.collectionIds?.length
            ? i.collectionIds.map((c) => c?._id || c)
            : ["__none__"];
          return ids.includes(selectedCollection);
        })
      : featuredItems;

    // "featured" preserves the curated order as-is.
    if (sortBy === "featured") return filtered;

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
  }, [featuredItems, sortBy, selectedCollection, isBulkParts]);

  // Reordering works in the featured view, including inside a collection /
  // part-type filter. A custom sort (name/price) can't be dragged since its
  // order is derived, not stored.
  const canReorder = isAdmin && sortBy === "featured";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = sortedItems.findIndex(
      (i) => i.inventoryItemId === active.id,
    );
    const newIndex = sortedItems.findIndex(
      (i) => i.inventoryItemId === over.id,
    );
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedVisible = arrayMove(sortedItems, oldIndex, newIndex);

    // Without a filter the visible list is the whole list — save it directly.
    if (!selectedCollection) {
      setOrderIds(reorderedVisible.map((i) => i.inventoryItemId));
      setHasOrderChanges(true);
      return;
    }

    // With a filter active, only the visible (filtered) items were rearranged.
    // Rebuild the full order by keeping every hidden item in its slot and
    // dropping the reordered filtered items back into the slots they occupied.
    const visibleIds = new Set(sortedItems.map((i) => i.inventoryItemId));
    let vi = 0;
    const fullOrder = featuredItems.map((item) =>
      visibleIds.has(item.inventoryItemId) ? reorderedVisible[vi++] : item,
    );
    setOrderIds(fullOrder.map((i) => i.inventoryItemId));
    setHasOrderChanges(true);
  };

  const handleSaveOrder = async () => {
    if (!hasOrderChanges) return;
    try {
      await reorderAddonItems({
        id: addon._id,
        itemOrder: featuredItems.map((i) => i.inventoryItemId),
      }).unwrap();
      setHasOrderChanges(false);
      toast.success("Order saved", {
        description: "Dealers will now see these items in this order.",
      });
    } catch (error) {
      toast.error("Failed to save order", {
        description: error?.data?.description || "Please try again.",
      });
    }
  };

  const handleResetOrder = () => {
    setOrderIds(null);
    setHasOrderChanges(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl overflow-hidden flex flex-col gap-0">
        <DialogHeader>
          <DialogTitle className="text-xl">{addon.addonName}</DialogTitle>
          <DialogDescription className={isAdmin ? "text-xs" : "sr-only"}>
            {isAdmin ? (
              canReorder ? (
                "Drag to reposition the listed items."
              ) : (
                "Switch to “Featured” sort to reorder items."
              )
            ) : (
              `${addon.addonName} items`
            )}
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
          {canReorder ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedItems.map((i) => i.inventoryItemId)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1">
                  {sortedItems.map((item) => (
                    <SortableAddonItem
                      key={item.key}
                      item={item}
                      onValueChange={onValueChange}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1">
              {sortedItems.map((item) => (
                <AddonItemCard
                  key={item.key}
                  item={item}
                  onValueChange={onValueChange}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-3">
          {isAdmin && hasOrderChanges ? (
            <>
              <Button
                variant="outline"
                onClick={handleResetOrder}
                disabled={isSavingOrder}
              >
                Reset
              </Button>
              <Button
                variant="accent"
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
              >
                {isSavingOrder ? "Saving..." : "Save Order"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="accent" disabled={!canSubmit} onClick={onConfirm}>
                {isUpdate ? "Update Order" : "Add to Order"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddonPreviewModal;
