import React from "react";
import { Search, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import AdminManagementHeader from "@/components/shared/AdminManagementHeader";
import TableLayout from "@/components/table/TableLayout";
import ColorSwatch from "@/components/shared/ColorSwatch";
import {
  ActionsColumn,
  TableCell,
  TimestampCells,
  StatusCell,
} from "@/components/table/BaseColumn";
import {
  AdminFormInput,
  AdminFormTextarea,
  AdminFormSelect,
} from "@/components/shared/AdminFormInput";
import QuantityControl from "@/components/shared/QuantityControl";
import VisibilitySwitch from "@/components/shared/VisibilitySwitch";
import AddUpdateItemDialog from "@/components/table/AddUpdateItemDialog";
import DeleteDialog from "@/components/table/DeleteDialog";
import { formatCurrency, display } from "@/utils/formatting";
import CommonImage from "@/components/shared/CommonImage";
import useDealerAddonManagement from "@/hooks/admin/useDealerAddonManagement";

const DealerAddonManagement = () => {
  const {
    dialogOpen,
    deleteDialogOpen,
    selectedItem,
    dialogMode,
    formData,
    page,
    limit,
    search,
    addons,
    totalItems,
    totalPages,
    startItem,
    endItem,
    handlePrevious,
    handleNext,
    columns,
    sortedInventoryItems,
    bundleItems,
    bundleDisplayItems,
    selectedBundleItemIds,
    isBundleType,
    isUpgradeType,
    isLoadingAddons,
    isLoadingInventory,
    isSubmitting,
    isDeleting,
    handleChange,
    handleValueChange,
    itemSearch,
    handleItemSearchChange,
    handleToggleBundleItem,
    handleRemoveBundleItem,
    handleBundleItemQuantityValue,
    handleBundleItemPricePerBag,
    handleSubmit,
    handleDialogClose,
    handleAdd,
    handleEdit,
    handleDelete,
    handleConfirmDelete,
    handlePageChange,
    handleLimitChange,
    handleSearchChange,
    setDeleteDialogOpen,
  } = useDealerAddonManagement();

  return (
    <div className="space-y-5">
      {/* Admin Page Header */}
      <AdminManagementHeader
        title="Dealer Add-on Management"
        description="Manage dealer add-ons — bundles from inventory or service upgrades"
        actionLabel="Add Add-on"
        onAction={handleAdd}
      />

      {/* Table Layout */}
      <TableLayout
        searchPlaceholder="Search add-ons..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        entriesValue={limit}
        onEntriesChange={handleLimitChange}
        page={page}
        onPageChange={handlePageChange}
        totalItems={totalItems}
        totalPages={totalPages}
        startItem={startItem}
        endItem={endItem}
        onPrevious={handlePrevious}
        onNext={handleNext}
        columns={columns}
        data={addons}
        isLoading={isLoadingAddons}
        renderRow={(addon) => (
          <>
            {/* Add-on Name */}
            <TableCell maxWidth="200px">{display(addon.addonName)}</TableCell>

            {/* Type */}
            <TableCell className="capitalize">{addon.addonType}</TableCell>

            {/* Description */}
            <TableCell maxWidth="300px">{display(addon.description)}</TableCell>

            {/* Price */}
            <TableCell>
              {addon.addonType === "bundle" ? (
                <span>Per Item Picking</span>
              ) : addon.price === 0 ? (
                "Free"
              ) : (
                formatCurrency(addon.price)
              )}
            </TableCell>

            {/* Status */}
            <StatusCell isActive={addon.isActive} />

            {/* Timestamps */}
            <TimestampCells
              createdAt={addon.createdAt}
              updatedAt={addon.updatedAt}
            />

            {/* Actions */}
            <ActionsColumn
              onEdit={() => handleEdit(addon)}
              onDelete={() => handleDelete(addon)}
            />
          </>
        )}
      />

      {/* Add/Update Dialog */}
      <AddUpdateItemDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        mode={dialogMode}
        entityName="Add-on"
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        className="sm:max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Add-on Name */}
            <AdminFormInput
              label="Add-on Name"
              name="addonName"
              placeholder="Accessories, Animal Pieces"
              value={formData.addonName}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            />

            {/* Add-on Type Select */}
            <AdminFormSelect
              label="Type"
              name="addonType"
              value={formData.addonType}
              onValueChange={handleValueChange("addonType")}
              disabled={isSubmitting || dialogMode === "edit"}
              options={[
                { value: "bundle", label: "Bundle" },
                { value: "upgrade", label: "Upgrade" },
              ]}
              placeholder="Select type"
            />
          </div>

          {/* Description */}
          <AdminFormTextarea
            label="Description"
            name="description"
            placeholder="Enter add-on description..."
            value={formData.description}
            onChange={handleChange}
            disabled={isSubmitting}
          />

          {isBundleType && (
            <div className="space-y-4">
              {/* Select Items */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium">Select Items</h4>
                  {selectedBundleItemIds.size > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {selectedBundleItemIds.size} selected
                    </span>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                    className="w-full"
                    disabled={isSubmitting || isLoadingInventory}
                  >
                    <Button
                      variant="outline"
                      className="w-full justify-between shadow-none hover:bg-input/50"
                    >
                      Add-ons
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent>
                    <DropdownMenuLabel className="border-b">
                      <div className="flex items-center gap-2">
                        <Search className="size-4 text-muted-foreground shrink-0" />
                        <Input
                          type="text"
                          placeholder="Search items..."
                          value={itemSearch}
                          onChange={handleItemSearchChange}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="h-8 border-0 shadow-none px-2 bg-transparent focus-visible:ring-0"
                          disabled={isSubmitting || isLoadingInventory}
                        />
                      </div>
                    </DropdownMenuLabel>

                    <div className="max-h-60 overflow-y-auto p-1">
                      {isLoadingInventory ? (
                        <div className="p-2 text-sm text-center text-muted-foreground">
                          Loading...
                        </div>
                      ) : sortedInventoryItems.length === 0 ? (
                        <div className="p-2 text-sm text-center text-muted-foreground">
                          No items found
                        </div>
                      ) : (
                        sortedInventoryItems.map((inv) => (
                          <DropdownMenuCheckboxItem
                            key={inv._id}
                            checked={selectedBundleItemIds.has(inv._id)}
                            onCheckedChange={() =>
                              handleToggleBundleItem(inv._id, inv)
                            }
                            onSelect={(e) => e.preventDefault()}
                          >
                            <div className="flex items-center justify-between gap-4 w-full">
                              <ColorSwatch
                                color={inv.colorId?.hexCode}
                                label={inv.minifigName}
                              />
                              {(inv.stock === 0 || !inv.stock) && (
                                <Badge
                                  variant="destructive"
                                  className="uppercase text-[8px] px-1 leading-none"
                                >
                                  Out of Stock
                                </Badge>
                              )}
                            </div>
                          </DropdownMenuCheckboxItem>
                        ))
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Adjust Quantities */}
              {bundleItems.length > 0 && (
                <div className="space-y-2">
                  <Label>Quantity per Bag</Label>

                  {bundleDisplayItems.map((item) => {
                    return (
                      <div
                        key={item.inventoryItemId}
                        className="flex items-center gap-3 p-2 rounded-md border"
                      >
                        {/* Image */}
                        <CommonImage
                          src={item.inventory.image?.url}
                          alt={item.inventory.minifigName}
                          className="w-20 aspect-4/3"
                        />

                        {/* Name + Color & Price */}
                        <div className="flex flex-col min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold line-clamp-1">
                              {item.inventory.minifigName}
                            </span>
                            {item.inventory.isActive === false && (
                              <Badge
                                variant="destructive"
                                className="uppercase text-[9px] px-2 py-0"
                              >
                                Inactive
                              </Badge>
                            )}
                            {(Number(item.inventory.stock || 0) <
                              Number(item.quantityPerBag || 1) ||
                              !item.inventory.stock) && (
                              <Badge
                                variant="destructive"
                                className="uppercase text-[9px] px-1.5 py-0"
                              >
                                Out of Stock
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {item.inventory.colorId?.colorName || "—"}
                            {" · "}
                            <span className="text-success dark:text-accent font-bold">
                              {formatCurrency(item.inventory.price)}
                            </span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold shrink-0">
                              Price per Bag:
                            </span>
                            <div className="relative flex items-center">
                              <span className="absolute left-2 text-xs text-muted-foreground">
                                $
                              </span>
                              <Input
                                type="text"
                                inputMode="decimal"
                                className="pl-5 pr-1 text-xs w-20 h-6"
                                value={item.pricePerBag}
                                onChange={(e) =>
                                  handleBundleItemPricePerBag(
                                    item.inventoryItemId,
                                    e.target.value,
                                  )
                                }
                                onBlur={(e) => {
                                  const num = parseFloat(e.target.value);
                                  handleBundleItemPricePerBag(
                                    item.inventoryItemId,
                                    isNaN(num) ? "0.00" : num.toFixed(2),
                                  );
                                }}
                                disabled={isSubmitting}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Quantity controls */}
                        <QuantityControl
                          value={item.quantityPerBag}
                          onChange={(value) =>
                            handleBundleItemQuantityValue(
                              item.inventoryItemId,
                              value,
                            )
                          }
                          min={1}
                          max={Number(item.inventory.stock || 0)}
                          allowInput
                        />

                        {/* Remove */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 size-8 text-destructive hover:text-destructive"
                          onClick={() =>
                            handleRemoveBundleItem(item.inventoryItemId)
                          }
                          disabled={isSubmitting}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Upgrade-specific: Manual price */}
          {isUpgradeType && (
            <AdminFormInput
              label="Price"
              name="price"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.price}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          )}

          {/* Visibility */}
          <VisibilitySwitch
            checked={formData.isActive}
            onChange={handleValueChange("isActive")}
            disabled={isSubmitting}
          />
        </div>
      </AddUpdateItemDialog>

      {/* Delete Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemName={display(selectedItem?.addonName)}
        title="Delete Add-on"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default DealerAddonManagement;
