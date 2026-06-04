import React, { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
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
import VisibilitySwitch from "@/components/shared/VisibilitySwitch";
import AddUpdateItemDialog from "@/components/table/AddUpdateItemDialog";
import DeleteDialog from "@/components/table/DeleteDialog";
import { formatCurrency, display } from "@/utils/formatting";
import CommonImage from "@/components/shared/CommonImage";
import MediaUpload from "@/components/shared/MediaUpload";
import useDealerAddonManagement, {
  ADDON_ITEM_CATEGORIES,
  ADDON_CHANNEL_SELECT_OPTIONS,
} from "@/hooks/admin/useDealerAddonManagement";

const InventoryDropdownItem = ({ inv, checked, onCheckedChange }) => (
  <DropdownMenuCheckboxItem
    checked={checked}
    onCheckedChange={onCheckedChange}
    onSelect={(e) => e.preventDefault()}
    className="py-2"
  >
    <div className="flex items-center gap-2 w-full min-w-0">
      {/* Thumbnail */}
      <CommonImage
        src={inv.image?.url}
        alt={inv.minifigName}
        className="w-12 aspect-4/3"
      />

      {/* Info */}
      <div className="flex flex-col min-w-0 flex-1 gap-2">
        <span className="text-sm font-medium leading-tight line-clamp-1">
          {inv.minifigName}
        </span>
        <ColorSwatch
          color={inv.colorId?.hexCode}
          label={inv.colorId?.colorName || "—"}
          className="text-xs text-muted-foreground"
        />
      </div>

      {/* Out of stock badge */}
      {(inv.stock === 0 || !inv.stock) && (
        <Badge
          variant="destructive"
          className="uppercase text-[8px] px-1 leading-none shrink-0"
        >
          Out of Stock
        </Badge>
      )}
    </div>
  </DropdownMenuCheckboxItem>
);

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
    groupedMinifigItems,
    groupedBulkPartItems,
    itemCategory,
    setItemCategory,
    selectAdjacentCategory,
    bundleItems,
    bundleDisplayItems,
    selectedBundleItemIds,
    isBundleType,
    isUpgradeType,
    computedDiscountedPrice,
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
    handleChannelSelectChange,
    channelSelectValue,
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
    filePreview,
    handleAddonFileChange,
    handleAddonFileRemove,
  } = useDealerAddonManagement();

  const activeTabRef = useRef(null);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [itemCategory]);

  const handleCategoryKeyDown = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    selectAdjacentCategory(e.key === "ArrowRight" ? 1 : -1);
  };

  return (
    <div className="space-y-5">
      {/* Admin Page Header */}
      <AdminManagementHeader
        title="Add-on Management"
        description="Manage dealer & wholesale add-ons — choose which channel each add-on shows on"
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

            {/* Price */}
            <TableCell>
              {addon.addonType === "bundle" ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                formatCurrency(addon.price)
              )}
            </TableCell>

            {/* Discount */}
            <TableCell>
              {addon.addonType === "upgrade" &&
              addon.discountPrice !== null &&
              addon.discountPrice !== undefined &&
              addon.price > 0 ? (
                <span className="font-semibold text-success">
                  {Math.round((1 - addon.discountPrice / addon.price) * 100)}%
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>

            {/* Discounted Price */}
            <TableCell>
              {addon.addonType === "upgrade" &&
              addon.discountPrice !== null &&
              addon.discountPrice !== undefined ? (
                addon.discountPrice === 0 ? (
                  <span className="font-semibold text-success">Free</span>
                ) : (
                  <span className="font-semibold text-success">
                    {formatCurrency(addon.discountPrice)}
                  </span>
                )
              ) : (
                <span className="text-muted-foreground">—</span>
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
        className="sm:max-w-3xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
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

            {/* Show on — which pages this add-on appears on */}
            <AdminFormSelect
              label="Display on"
              name="visibleChannels"
              value={channelSelectValue}
              onValueChange={handleChannelSelectChange}
              disabled={isSubmitting}
              options={ADDON_CHANNEL_SELECT_OPTIONS}
              placeholder="Select channel"
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

                  <DropdownMenuContent onKeyDown={handleCategoryKeyDown}>
                    {/* Category tabs — single scrollable row; use ←/→ keys to
                        switch tabs and reach off-screen ones */}
                    <div className="flex border-b px-1 pt-1 overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
                      {ADDON_ITEM_CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          ref={
                            itemCategory === cat.value
                              ? activeTabRef
                              : undefined
                          }
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setItemCategory(cat.value);
                          }}
                          className={[
                            "shrink-0 px-4 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap",
                            itemCategory === cat.value
                              ? "border-b-2 border-primary text-primary"
                              : "text-muted-foreground hover:text-foreground",
                          ].join(" ")}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

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

                    <div className="max-h-60 overflow-y-auto pt-2">
                      {isLoadingInventory ? (
                        <div className="p-2 text-sm text-center text-muted-foreground">
                          Loading...
                        </div>
                      ) : sortedInventoryItems.length === 0 ? (
                        <div className="p-2 text-sm text-center text-muted-foreground">
                          No items found
                        </div>
                      ) : itemCategory === "minifigs" && groupedMinifigItems ? (
                        groupedMinifigItems.map((group) => (
                          <div key={group.collectionName}>
                            <div className="p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              {group.collectionName}
                            </div>
                            {group.items.map((inv) => (
                              <InventoryDropdownItem
                                key={inv._id}
                                inv={inv}
                                checked={selectedBundleItemIds.has(inv._id)}
                                onCheckedChange={() =>
                                  handleToggleBundleItem(inv._id, inv)
                                }
                              />
                            ))}
                          </div>
                        ))
                      ) : itemCategory === "bulk-minifig-parts" &&
                        groupedBulkPartItems ? (
                        groupedBulkPartItems.map((group) => (
                          <div key={group.collectionName}>
                            <div className="p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              {group.collectionName}
                            </div>
                            {group.items.map((inv) => (
                              <InventoryDropdownItem
                                key={inv._id}
                                inv={inv}
                                checked={selectedBundleItemIds.has(inv._id)}
                                onCheckedChange={() =>
                                  handleToggleBundleItem(inv._id, inv)
                                }
                              />
                            ))}
                          </div>
                        ))
                      ) : (
                        sortedInventoryItems.map((inv) => (
                          <InventoryDropdownItem
                            key={inv._id}
                            inv={inv}
                            checked={selectedBundleItemIds.has(inv._id)}
                            onCheckedChange={() =>
                              handleToggleBundleItem(inv._id, inv)
                            }
                          />
                        ))
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Selected items — pricing/stock comes from GeneralInventory */}
              {bundleItems.length > 0 && (
                <div className="space-y-2">
                  {bundleDisplayItems.map((item) => {
                    const pricePerBag = Number(item.inventory.pricePerBag || 0);
                    const piecesPerBag = item.inventory.piecesPerBag ?? 1;
                    const stock = Number(item.inventory.stock || 0);
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

                        {/* Name + Color + Inventory metadata (read-only) */}
                        <div className="flex flex-col min-w-0 flex-1 space-y-2">
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
                            {stock === 0 && (
                              <Badge
                                variant="destructive"
                                className="uppercase text-[9px] px-1.5 py-0"
                              >
                                Out of Stock
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {piecesPerBag === 1
                              ? "1 minifig"
                              : `${piecesPerBag} pcs/bag`}
                            {" · "}
                            <span className="font-semibold text-success dark:text-accent">
                              ${pricePerBag.toFixed(2)}
                            </span>
                          </div>
                          <ColorSwatch
                            color={item.inventory.colorId?.hexCode}
                            label={item.inventory.colorId?.colorName || "—"}
                            className="text-xs text-muted-foreground"
                          />
                        </div>

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

          {/* Upgrade-specific: Original price + discount → auto discounted price */}
          {isUpgradeType && (
            <div className="grid grid-cols-3 gap-3">
              <AdminFormInput
                label="Original Price"
                name="price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.price}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              <AdminFormInput
                label="Discount (%)"
                name="discount"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="50"
                value={formData.discount}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              <AdminFormInput
                label="Discounted Price"
                name="discountedPrice"
                type="text"
                value={
                  computedDiscountedPrice === null
                    ? "0.00"
                    : computedDiscountedPrice === 0
                      ? "Free"
                      : formatCurrency(computedDiscountedPrice)
                }
                disabled
                readOnly
              />
            </div>
          )}

          {/* Badge (optional, all types) */}
          <AdminFormInput
            label="Badge"
            name="badge"
            placeholder="e.g. Spring Exclusive"
            value={formData.badge}
            onChange={handleChange}
            disabled={isSubmitting}
          />

          {/* Background Image (optional) */}
          <MediaUpload
            label="Background Image (optional)"
            preview={filePreview}
            onChange={handleAddonFileChange}
            onRemove={handleAddonFileRemove}
            accept="image/*"
            description="PNG, JPG, WEBP"
            disabled={isSubmitting}
          />

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
