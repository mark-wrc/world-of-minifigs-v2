import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { CheckoutButton } from "@/components/shared/OrderActionButton";
import ShippingCountrySelect from "@/components/shared/ShippingCountrySelect";
import { formatCurrency } from "@/utils/formatting";
import { ChevronDown, ChevronUp, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import QuantityControl from "@/components/shared/QuantityControl";

// ─── A single ordered bundle: name, copy-quantity control, torso-bag split ─────
const BundleRow = ({
  bundle,
  maxBundleQuantity,
  onBundleQtyChange,
  onSetTorsoBagQuantity,
  onRemoveBundle,
}) => (
  <div className="space-y-3">
    <div className="flex justify-between items-start gap-2">
      <p className="text-sm font-bold">{bundle.bundleName}</p>
      <p className="text-sm font-bold text-success dark:text-accent shrink-0">
        {formatCurrency(bundle.totalPrice)}
      </p>
    </div>

    {/* Bundle copy quantity — dealers can order up to maxBundleQuantity copies */}
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-col">
        <span className="text-xs font-medium text-foreground">
          Bundle Quantity
        </span>
        <span className="text-[10px] text-muted-foreground font-medium">
          {(bundle.minifigQuantity * bundle.quantity).toLocaleString()} minifigs
          total
        </span>
      </div>
      <QuantityControl
        value={bundle.quantity}
        onChange={(val) => {
          // Decrementing past 1 drops the whole bundle from the order.
          if (val < 1) {
            onRemoveBundle?.(bundle._id);
            return;
          }
          onBundleQtyChange?.(bundle._id, val);
        }}
        min={0}
        max={maxBundleQuantity}
        size="xs"
      />
    </div>

    {/* Torso bag split */}
    {bundle.bagMultiplier > 1 ? (
      <div className="space-y-2">
        {bundle.torsoBags.length > 0 && (
          <div className="space-y-1.5">
            {bundle.torsoBags.map((bag) => (
              <div
                key={bag._id}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-xs font-medium text-foreground flex-1 truncate">
                  {bag.bagName}
                </span>
                <QuantityControl
                  value={bag.quantity}
                  onChange={(val) =>
                    onSetTorsoBagQuantity?.(bundle._id, bag._id, val)
                  }
                  min={0}
                  max={bag.quantity + bundle.remainingBagSlots}
                  size="xs"
                />
              </div>
            ))}
          </div>
        )}

        {bundle.remainingBagSlots > 0 && bundle.torsoBags.length > 0 && (
          <p className="text-[10px] text-amber-500 dark:text-amber-400 font-medium">
            {bundle.remainingBagSlots} slot
            {bundle.remainingBagSlots !== 1 ? "s" : ""} remaining — fill all
            slots to checkout
          </p>
        )}
      </div>
    ) : (
      bundle.torsoBags.map((bag) => (
        <p key={bag._id} className="text-xs text-muted-foreground font-medium">
          {bag.bagName}
        </p>
      ))
    )}
  </div>
);

const DealerOrderSummary = ({
  bundles = [],
  addons = [],
  extraBags = [],
  totalExtraBags,
  totalOrderPrice,
  insuranceEnabled = false,
  insuranceAmount = 0,
  canCheckout,
  onCheckout,
  isCheckoutLoading,
  maxBundleQuantity = 4,
  onSetTorsoBagQuantity,
  onBundleQtyChange,
  onToggleInsurance,
  onRemoveAddonSubItem,
  onAddonQtyChange,
  onRemoveBundle,
}) => {
  const [expandedAddons, setExpandedAddons] = useState({});

  const toggleAddon = (id) => {
    setExpandedAddons((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const hasItems =
    bundles.length > 0 || addons.length > 0 || totalExtraBags > 0;

  return (
    <aside className="lg:sticky lg:top-24 space-y-5">
      <Card className="border-2 border-accent overflow-hidden p-0">
        <div className="bg-accent p-4 text-accent-foreground">
          <h3 className="text-lg font-bold uppercase tracking-tight">
            Order Summary
          </h3>
        </div>

        <div className="px-4 py-2 space-y-5">
          {/* Empty state */}
          {!hasItems && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ShoppingCart className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-semibold text-muted-foreground">
                No items yet
              </p>
            </div>
          )}

          {/* Bundles Section — one block per selected bundle */}
          {bundles.length > 0 && (
            <div className="space-y-5">
              {bundles.map((bundle, idx) => (
                <div
                  key={bundle._id}
                  className={idx > 0 ? "pt-4 border-t border-dashed" : ""}
                >
                  <BundleRow
                    bundle={bundle}
                    maxBundleQuantity={maxBundleQuantity}
                    onBundleQtyChange={onBundleQtyChange}
                    onSetTorsoBagQuantity={onSetTorsoBagQuantity}
                    onRemoveBundle={onRemoveBundle}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Add-ons Section */}
          {addons.length > 0 && (
            <div className="space-y-4">
              {addons.map((addon) => {
                const isExpanded = expandedAddons[addon._id];

                return (
                  <div key={addon._id} className="space-y-2 pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-3">
                        <p className="text-sm font-bold">{addon.addonName}</p>
                        {addon.hasSubItems && !isExpanded && (
                          <p className="text-xs text-muted-foreground font-medium">
                            {addon.itemCount} Item
                            {addon.itemCount !== 1 ? "s" : ""} (
                            {addon.totalBags} Bag
                            {addon.totalBags !== 1 ? "s" : ""})
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end space-y-3 shrink-0">
                        <p className="text-sm font-bold text-success dark:text-accent">
                          {addon.isFree ? "Free" : formatCurrency(addon.price)}
                        </p>
                        {addon.hasSubItems && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAddon(addon._id)}
                            className="h-auto pr-0! py-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-success hover:bg-transparent flex items-center justify-end"
                          >
                            {isExpanded ? (
                              <>
                                Hide{" "}
                                <ChevronUp className="ml-1 size-3 -mr-0.5" />
                              </>
                            ) : (
                              <>
                                Details{" "}
                                <ChevronDown className="ml-1 size-3 -mr-0.5" />
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Per-order quantity control (limited / unlimited upgrades) */}
                    {addon.isQuantityAdjustable && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-foreground">
                            Quantity
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {formatCurrency(addon.unitPrice)} each
                          </span>
                        </div>
                        <QuantityControl
                          value={addon.quantity}
                          onChange={(val) => onAddonQtyChange?.(addon._id, val)}
                          min={0}
                          max={addon.maxQuantity}
                          size="xs"
                        />
                      </div>
                    )}

                    {/* Expandable Details */}
                    {addon.items?.length > 0 &&
                      (isExpanded || !addon.hasSubItems) && (
                        <div className="space-y-2 pl-2 border-l-2 border-accent/20 mt-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 pr-1">
                          {addon.items.map((item) => (
                            <div
                              key={item.inventoryItemId}
                              className="flex items-center justify-between text-xs gap-2"
                            >
                              <div className="flex items-center gap-1 min-w-0 flex-1">
                                {onRemoveAddonSubItem && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      onRemoveAddonSubItem(
                                        addon._id,
                                        item.inventoryItemId,
                                      )
                                    }
                                    aria-label={`Remove ${item.itemName}`}
                                    title="Remove item"
                                    className="size-4 p-0 shrink-0 text-destructive hover:text-destructive/80 hover:bg-transparent"
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                )}
                                <span className="text-muted-foreground font-medium pr-2 truncate">
                                  {item.itemName} × {item.selectedBags} bag
                                  {item.selectedBags === 1 ? "" : "s"}
                                </span>
                              </div>
                              <span className="font-bold text-success/80 dark:text-accent/80 shrink-0">
                                {formatCurrency(item.selectedTotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Extra Bags Section */}
          {totalExtraBags > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold">Extra Bags ({totalExtraBags})</p>
              <div className="space-y-2">
                {extraBags.map((bag) => (
                  <div
                    key={bag._id}
                    className="flex justify-between items-center"
                  >
                    <span className="text-xs text-muted-foreground font-medium">
                      {bag.qty} x Extra {bag.subCollectionId?.subCollectionName}
                    </span>
                    <span className="font-bold text-success dark:text-accent shrink-0">
                      {formatCurrency(bag.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals Section */}
          <div className="pt-5 border-t border-dashed">
            {/* Optional Shipping Insurance */}
            {hasItems && (
              <div className="flex items-start justify-between gap-3 pb-4 mb-4 border-b border-dashed">
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="dealer-shipping-insurance"
                    checked={insuranceEnabled}
                    onCheckedChange={onToggleInsurance}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="dealer-shipping-insurance"
                    className="cursor-pointer flex flex-col items-start gap-0.5"
                  >
                    <span className="text-sm font-bold flex items-center gap-1.5">
                      Shipping Insurance
                    </span>
                    <span className="text-xs text-muted-foreground font-medium leading-snug">
                      Protect your order against loss, theft, or damage during
                      shipping.
                    </span>
                  </Label>
                </div>
                <span className="text-sm font-bold text-success dark:text-accent shrink-0">
                  {formatCurrency(insuranceAmount)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold uppercase text-muted-foreground">
                Total Amount
              </span>
              <p className="text-3xl font-black text-success dark:text-accent">
                {formatCurrency(totalOrderPrice)}
              </p>
            </div>

            {hasItems && (
              <ShippingCountrySelect
                disabled={isCheckoutLoading}
                className="mb-4"
              />
            )}

            <CheckoutButton
              label="Proceed to Payment"
              disabled={!canCheckout}
              onClick={onCheckout}
              isLoading={isCheckoutLoading}
              className="mb-3 h-12"
            />
          </div>
        </div>
      </Card>
    </aside>
  );
};

export default DealerOrderSummary;
