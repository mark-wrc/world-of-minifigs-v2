import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { CheckoutButton } from "@/components/shared/OrderActionButton";
import { formatCurrency } from "@/utils/formatting";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const DealerOrderSummary = ({
  selectedBundle,
  addons,
  extraBags,
  torsoBags,
  totalExtraBags,
  totalOrderPrice,
  canCheckout,
  onCheckout,
  isCheckoutLoading,
}) => {
  const [expandedAddons, setExpandedAddons] = useState({});

  const toggleAddon = (id) => {
    setExpandedAddons((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <aside className="lg:sticky lg:top-24 space-y-5">
      <Card className="border-2 border-accent overflow-hidden p-0">
        <div className="bg-accent p-4 text-accent-foreground">
          <h3 className="text-lg font-bold uppercase tracking-tight">
            Order Summary
          </h3>
        </div>

        <div className="px-4 py-2 space-y-5">
          {/* Main Bundle Section */}
          {selectedBundle && (
            <div className="space-y-3 pb-3">
              <div className="flex justify-between items-start gap-2">
                <div className="space-y-2">
                  <p className="text-sm font-bold">
                    {selectedBundle.bundleName}
                  </p>
                  {torsoBags.map((bag) => (
                    <p
                      key={bag._id}
                      className="text-xs text-muted-foreground font-medium"
                    >
                      {bag.bagName}
                    </p>
                  ))}
                </div>
                <p className="text-sm font-bold text-success dark:text-accent shrink-0">
                  {formatCurrency(selectedBundle.totalPrice)}
                </p>
              </div>
            </div>
          )}

          {/* Add-ons Section */}
          {addons.length > 0 && (
            <div className="space-y-4">
              {addons.map((addon) => {
                const isExpanded = expandedAddons[addon._id];

                return (
                  <div
                    key={addon._id}
                    className="space-y-2 pb-2"
                  >
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

                    {/* Expandable Details */}
                    {addon.items?.length > 0 &&
                      (isExpanded || !addon.hasSubItems) && (
                        <div className="space-y-2 pl-2 border-l-2 border-accent/20 mt-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 pr-1">
                          {addon.items.map((item) => (
                            <div
                              key={item.inventoryItemId}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-muted-foreground font-medium pr-2">
                                {item.itemName} × {item.selectedBags} bag
                                {item.selectedBags === 1 ? "" : "s"}
                              </span>
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
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold uppercase text-muted-foreground">
                Total Amount
              </span>
              <p className="text-3xl font-black text-success dark:text-accent">
                {formatCurrency(totalOrderPrice)}
              </p>
            </div>

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
