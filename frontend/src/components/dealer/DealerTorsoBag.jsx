import { useEffect, useMemo, useState } from "react";
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
} from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import CommonImage from "@/components/shared/CommonImage";
import MiscellaneousPreview from "@/components/dealer/MiscellaneousPreview";
import {
  PreviewItem,
  SortablePreviewItem,
} from "@/components/dealer/TorsoPreviewItems";
import { useReorderTorsoBagItemsMutation } from "@/redux/api/adminApi";

// ─── Shared grid — renders items + misc tail in one place ──────────────────────
const PreviewGrid = ({
  items,
  miscQuantity,
  isAdmin,
  multiplier,
  reorderItemIds,
  reorderSensors,
  onDragEnd,
}) => {
  const itemNodes = isAdmin
    ? items.map((item, idx) => (
        <SortablePreviewItem
          key={idx}
          id={idx.toString()}
          item={item}
          idx={idx}
          displayQuantity={item.quantity * multiplier}
        />
      ))
    : items.map((item, idx) => (
        <PreviewItem
          key={idx}
          item={item}
          idx={idx}
          displayQuantity={item.displayQuantity}
        />
      ));

  const grid = (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {itemNodes}
      {miscQuantity > 0 && <MiscellaneousPreview miscQuantity={miscQuantity} />}
    </div>
  );

  if (!isAdmin) return grid;

  return (
    <DndContext
      sensors={reorderSensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={reorderItemIds} strategy={rectSortingStrategy}>
        {grid}
      </SortableContext>
    </DndContext>
  );
};

// ─── Main component — one instance per selected bundle ─────────────────────────
const DealerTorsoBag = ({ section, isAdmin, onSelectTorsoBag }) => {
  const {
    bundle,
    bundleId,
    bagMultiplier,
    torsoBags,
    lastSelectedBag,
    multiplier,
    miscQuantity,
    displayItems,
  } = section;

  const rawTorsoQty = (bag) =>
    bag?.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

  // ─── Admin reorder — self-contained per previewed torso bag ──────────────────
  const [reorderTorsoBagItems] = useReorderTorsoBagItemsMutation();
  const [localItems, setLocalItems] = useState([]);
  const [hasReorderChanges, setHasReorderChanges] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  useEffect(() => {
    setLocalItems(lastSelectedBag?.items || []);
    setHasReorderChanges(false);
  }, [lastSelectedBag]);

  const reorderSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const reorderItemIds = useMemo(
    () => localItems.map((_, idx) => idx.toString()),
    [localItems],
  );

  const handleReorderDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id && lastSelectedBag) {
      const oldIndex = parseInt(active.id);
      const newIndex = parseInt(over.id);
      setLocalItems((prev) => arrayMove(prev, oldIndex, newIndex));
      setHasReorderChanges(true);
    }
  };

  const handleSaveReorder = async () => {
    if (!lastSelectedBag || !hasReorderChanges) return;
    setIsSavingOrder(true);
    try {
      const reorderIndices = localItems.map((newItem) =>
        lastSelectedBag.items.findIndex(
          (origItem) => origItem.image?.url === newItem.image?.url,
        ),
      );
      await reorderTorsoBagItems({
        id: lastSelectedBag._id,
        itemOrder: reorderIndices,
      }).unwrap();
      setHasReorderChanges(false);
    } catch (error) {
      console.error("Failed to save order:", error);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleResetReorder = () => {
    setLocalItems(lastSelectedBag?.items || []);
    setHasReorderChanges(false);
  };

  return (
    <section className="overflow-visible">
      <div className="text-left mb-5">
        <h2 className="text-2xl font-bold mb-2 tracking-tight">
          {bundle.bundleName} —{" "}
          {torsoBags.length === 1
            ? "Review Your LEGO Torsos"
            : "Choose Your LEGO Torso"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {torsoBags.length === 1
            ? "Your bundle includes the following curated torso designs."
            : bagMultiplier > 1
              ? `This bundle includes ${bagMultiplier} bags — customize the split in the order summary.`
              : "Select your preferred torso bag design."}
        </p>
      </div>

      {/* Torso Bags Selection Area */}
      {torsoBags.length === 1 ? (
        <Card className="relative transition-all duration-300 overflow-hidden shadow-none">
          <div className="flex flex-col md:flex-row items-stretch">
            {/* Bag Visual */}
            <div className="w-full md:w-1/4 flex items-center justify-center relative overflow-hidden">
              <div className="relative">
                <CommonImage
                  src={torsoBags[0].firstImage}
                  alt={torsoBags[0].bagName}
                  className="h-40"
                />
              </div>
            </div>

            {/* Bag Details */}
            <div className="flex-1 p-5 flex flex-col justify-center space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-3xl font-black uppercase tracking-tighter text-foreground mb-1">
                    {torsoBags[0].bagName}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <span className="text-sm uppercase font-bold text-muted-foreground whitespace-nowrap">
                    Torso Pieces
                  </span>
                  <p className="font-bold text-xl">
                    {multiplier * rawTorsoQty(torsoBags[0])} Units
                  </p>
                </div>
                <div className="space-y-2">
                  <span className="text-sm uppercase font-bold text-muted-foreground whitespace-nowrap">
                    Mystery Parts
                  </span>
                  <p className="font-bold text-xl">{miscQuantity} torsos</p>
                </div>
                <div className="space-y-2">
                  <span className="text-sm uppercase font-bold text-muted-foreground whitespace-nowrap">
                    Full Bundle Total
                  </span>
                  <p className="font-bold text-xl">
                    {multiplier * rawTorsoQty(torsoBags[0]) + miscQuantity}{" "}
                    Minifigs
                  </p>
                </div>
                <div className="space-y-2">
                  <span className="text-sm uppercase font-bold text-muted-foreground whitespace-nowrap">
                    Variety
                  </span>
                  <p className="font-bold text-xl">
                    {torsoBags[0].items?.length || 0} Unique Designs
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {torsoBags.map((bag) => (
            <Card
              key={bag._id}
              onClick={() => onSelectTorsoBag(bundleId, bag._id)}
              className={`relative cursor-pointer transition-all duration-300 group p-0 gap-0 overflow-visible hover:shadow-2xl hover:-translate-y-2 ${
                bag.isSelected
                  ? "border-accent ring-2 ring-accent ring-offset-2"
                  : ""
              }`}
            >
              {bag.isSelected && (
                <Badge
                  variant="accent"
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-sm font-bold px-3 py-1 whitespace-nowrap z-10 uppercase tracking-widest"
                >
                  {bagMultiplier > 1 ? `×${bag.assignedQty}` : "Selected"}
                </Badge>
              )}

              <div className="flex items-center justify-center p-4 mt-2 group-hover:scale-110 transition-transform duration-500">
                <CommonImage
                  src={bag.firstImage}
                  alt={bag.bagName}
                  className="aspect-4/3 object-contain drop-shadow-md"
                />
              </div>

              <div
                className={`p-2.5 text-center transition-colors duration-300 ${
                  bag.isSelected ? "bg-accent text-accent-foreground" : ""
                }`}
              >
                <h3 className="text-sm font-black uppercase tracking-tight line-clamp-1">
                  {bag.bagName}
                </h3>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Section */}
      {lastSelectedBag && displayItems.length > 0 && (
        <div className="space-y-5 pt-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                {lastSelectedBag.bagName} Preview
                {multiplier > 1 && (
                  <Badge variant="accent" className="text-xs">
                    {multiplier}× Bag
                  </Badge>
                )}
              </h3>

              <p className="text-muted-foreground text-sm">
                {displayItems.length} unique designs •{" "}
                {multiplier === 1
                  ? "1 bag"
                  : `${multiplier} bag${multiplier !== 1 ? "s" : ""} of this design`}
                {isAdmin && (
                  <span className="ml-1 text-primary"> • Drag to reorder</span>
                )}
              </p>
            </div>

            {isAdmin && hasReorderChanges && (
              <div className="flex items-center gap-2 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetReorder}
                  disabled={isSavingOrder}
                >
                  Reset
                </Button>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={handleSaveReorder}
                  disabled={isSavingOrder}
                >
                  {isSavingOrder ? "Saving..." : "Save Order"}
                </Button>
              </div>
            )}
          </div>

          {/* Grid — admin gets drag-and-drop, others get static */}
          <PreviewGrid
            items={isAdmin ? localItems : displayItems}
            miscQuantity={miscQuantity}
            isAdmin={isAdmin}
            multiplier={multiplier}
            reorderItemIds={reorderItemIds}
            reorderSensors={reorderSensors}
            onDragEnd={handleReorderDragEnd}
          />
        </div>
      )}
    </section>
  );
};

export default DealerTorsoBag;
