import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import CommonImage from "@/components/shared/CommonImage";
import QuantityControl from "@/components/shared/QuantityControl";
import { formatCurrency } from "@/utils/formatting";

const AddonPreviewModal = ({
  addon,
  items,
  totalBags,
  totalPrice,
  canSubmit,
  isUpdate,
  onClose,
  onConfirm,
  onValueChange,
}) => {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl overflow-hidden flex flex-col gap-0">
        <DialogHeader>
          <DialogTitle className="text-xl">{addon.addonName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1">
            {items.map((item) => (
              <div
                key={item.key}
                className={`relative rounded-md border p-2 transition-all duration-300 ${
                  item.isActive ? "border-accent border-l-4" : "border"
                } ${item.isOutOfStock ? "opacity-60 grayscale-[0.5]" : ""}`}
              >
                {/* Out of Stock Badge */}
                {item.isOutOfStock && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge variant="destructive" className="uppercase text-[10px] px-1.5 py-0">
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
                          - {item.perBagLimit === 1 ? "1 minifig" : `${item.perBagLimit} pcs/bag`}
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

        <DialogFooter className="pt-3 sm:justify-between items-center">
          <div className="font-bold text-sm">
            Total:{" "}
            <span className="text-success dark:text-accent">
              {formatCurrency(totalPrice)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="accent" disabled={!canSubmit} onClick={onConfirm}>
              {isUpdate ? "Update Order" : "Add to Order"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddonPreviewModal;
