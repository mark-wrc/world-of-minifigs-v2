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
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import CommonImage from "@/components/shared/CommonImage";

// Display-only gallery for `upgrade` add-ons. Shows what the dealer receives
// once purchased — no quantity control or customisation. Confirming simply
// adds the add-on to the order.
const UpgradePreviewModal = ({ addon, isSelected, onClose, onConfirm }) => {
  const images = addon?.previewImages || [];
  // Admin-authored preview blurb, falling back to the add-on's description.
  const previewDescription = addon?.previewDescription || addon?.description;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">{addon.addonName}</DialogTitle>
          <DialogDescription
            className={previewDescription ? "text-sm" : "sr-only"}
          >
            {previewDescription || `${addon.addonName} preview`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {images.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {images.map((img, index) => (
                <div
                  key={img.publicId || index}
                  className="flex flex-col gap-3"
                >
                  <HoverCard openDelay={150} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      <div className="cursor-zoom-in">
                        <CommonImage
                          src={img.url}
                          alt={img.label || addon.addonName}
                          className="w-full aspect-4/3 object-contain rounded"
                        />
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent>
                      <CommonImage
                        src={img.url}
                        alt={img.label || addon.addonName}
                        className="w-80"
                      />
                    </HoverCardContent>
                  </HoverCard>
                  {img.label && (
                    <p className="text-md font-semibold text-center line-clamp-2">
                      {img.label}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No preview available.
            </p>
          )}
        </div>

        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="accent" onClick={onConfirm}>
            {isSelected ? "Added" : "Add to Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePreviewModal;
