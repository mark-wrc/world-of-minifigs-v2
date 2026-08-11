import React, { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import AdminManagementHeader from "@/components/shared/AdminManagementHeader";
import TableLayout from "@/components/table/TableLayout";
import ColorSwatch from "@/components/shared/ColorSwatch";
import CommonImage from "@/components/shared/CommonImage";
import {
  ActionsColumn,
  TableCell,
  TimestampCells,
} from "@/components/table/BaseColumn";
import { AdminFormInput } from "@/components/shared/AdminFormInput";
import VisibilitySwitch from "@/components/shared/VisibilitySwitch";
import AddUpdateItemDialog from "@/components/table/AddUpdateItemDialog";
import DeleteDialog from "@/components/table/DeleteDialog";
import { formatCurrency, display } from "@/utils/formatting";
import useFlashSaleManagement, {
  FLASH_SALE_ITEM_CATEGORIES,
  FLASH_SALE_STATUS_FILTERS,
  previewSalePrice,
} from "@/hooks/admin/useFlashSaleManagement";

// Status chip colours keyed by the backend-derived status.
const STATUS_STYLES = {
  scheduled: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  active: "bg-success text-white",
  paused: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  ended: "bg-muted text-muted-foreground",
};

const fmtDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

// One selectable inventory row inside the picker dropdown.
const InventoryDropdownItem = ({ inv, checked, onCheckedChange }) => (
  <DropdownMenuCheckboxItem
    checked={checked}
    onCheckedChange={onCheckedChange}
    onSelect={(e) => e.preventDefault()}
    className="py-2"
  >
    <div className="flex items-center gap-2 w-full min-w-0">
      <CommonImage
        src={inv.image?.url}
        alt={inv.minifigName}
        className="w-12 aspect-4/3"
      />
      <div className="flex flex-col min-w-0 flex-1 gap-1">
        <span className="text-sm font-medium leading-tight line-clamp-1">
          {inv.minifigName}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ColorSwatch
            color={inv.colorId?.hexCode}
            label={inv.colorId?.colorName || "—"}
          />
          <span>·</span>
          <span className="font-semibold text-success dark:text-accent">
            {formatCurrency(inv.pricePerBag)}
          </span>
        </div>
      </div>
    </div>
  </DropdownMenuCheckboxItem>
);

const FlashSaleManagement = () => {
  const {
    dialogOpen,
    deleteDialogOpen,
    selectedItem,
    dialogMode,
    formData,
    page,
    limit,
    search,
    flashSales,
    totalItems,
    totalPages,
    startItem,
    endItem,
    handlePrevious,
    handleNext,
    columns,
    statusFilter,
    setStatusFilter,
    sortedInventoryItems,
    groupedMinifigItems,
    groupedBulkPartItems,
    selectedItemIds,
    itemCategory,
    setItemCategory,
    selectAdjacentCategory,
    itemSearch,
    handleItemSearchChange,
    isLoadingInventory,
    saleDisplayItems,
    handleToggleItem,
    handleRemoveItem,
    handleItemDiscountValueChange,
    isLoadingSales,
    isSubmitting,
    isDeleting,
    handleChange,
    handleValueChange,
    handleSubmit,
    handleEdit,
    handleDuplicate,
    handleDialogClose,
    handleAdd,
    handleDelete,
    handleConfirmDelete,
    handlePageChange,
    handleLimitChange,
    handleSearchChange,
    setDeleteDialogOpen,
  } = useFlashSaleManagement();

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

  const renderPicker = () => {
    if (isLoadingInventory) {
      return (
        <div className="p-2 text-sm text-center text-muted-foreground">
          Loading...
        </div>
      );
    }
    if (sortedInventoryItems.length === 0) {
      return (
        <div className="p-2 text-sm text-center text-muted-foreground">
          No items found
        </div>
      );
    }
    const groups =
      (itemCategory === "minifigs" && groupedMinifigItems) ||
      (itemCategory === "bulk-minifig-parts" && groupedBulkPartItems) ||
      null;

    if (groups) {
      return groups.map((group) => (
        <div key={group.collectionName}>
          <div className="p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {group.collectionName}
          </div>
          {group.items.map((inv) => (
            <InventoryDropdownItem
              key={inv._id}
              inv={inv}
              checked={selectedItemIds.has(inv._id)}
              onCheckedChange={() => handleToggleItem(inv._id, inv)}
            />
          ))}
        </div>
      ));
    }

    return sortedInventoryItems.map((inv) => (
      <InventoryDropdownItem
        key={inv._id}
        inv={inv}
        checked={selectedItemIds.has(inv._id)}
        onCheckedChange={() => handleToggleItem(inv._id, inv)}
      />
    ));
  };

  return (
    <div className="space-y-5">
      <AdminManagementHeader
        title="Flash Sales"
        description="Run a time-boxed sale with a shared window and a custom discount per item"
        actionLabel="Add Flash Sale"
        onAction={handleAdd}
      />

      <TableLayout
        searchPlaceholder="Search flash sales..."
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
        data={flashSales}
        isLoading={isLoadingSales}
        searchExtra={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              {FLASH_SALE_STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        renderRow={(sale) => (
          <>
            <TableCell maxWidth="200px">{display(sale.name)}</TableCell>
            <TableCell>
              <span className="text-xs whitespace-nowrap">
                {fmtDateTime(sale.startAt)} → {fmtDateTime(sale.endAt)}
              </span>
            </TableCell>
            <TableCell>{sale.itemCount ?? sale.items?.length ?? 0}</TableCell>
            <TableCell>
              <Badge
                className={`font-medium capitalize ${
                  STATUS_STYLES[sale.status] || STATUS_STYLES.ended
                }`}
              >
                {sale.status}
              </Badge>
            </TableCell>
            <TimestampCells createdAt={sale.createdAt} withTime />
            <ActionsColumn
              onEdit={() => handleEdit(sale)}
              onExport={() => handleDuplicate(sale)}
              exportTitle="Duplicate"
              onDelete={() => handleDelete(sale)}
            />
          </>
        )}
      />

      {/* Add/Update Dialog */}
      <AddUpdateItemDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        mode={dialogMode}
        entityName="Flash Sale"
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        className="sm:max-w-4xl"
      >
        <div className="space-y-4">
          {/* Name */}
          <AdminFormInput
            label="Sale Name"
            name="name"
            placeholder="e.g. Weekend Accessory Blowout"
            value={formData.name}
            onChange={handleChange}
            disabled={isSubmitting}
            required
          />

          {/* Shared window */}
          <div className="grid grid-cols-2 gap-3">
            <AdminFormInput
              label="Starts"
              name="startAt"
              type="datetime-local"
              value={formData.startAt}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            <AdminFormInput
              label="Ends"
              name="endAt"
              type="datetime-local"
              value={formData.endAt}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          {/* Item picker */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">Sale Items</h4>
              {selectedItemIds.size > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedItemIds.size} selected
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
                  Add items to sale
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent onKeyDown={handleCategoryKeyDown}>
                {/* Category tabs */}
                <div className="flex border-b px-1 pt-1 overflow-x-auto scrollbar-thin">
                  {FLASH_SALE_ITEM_CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      ref={
                        itemCategory === cat.value ? activeTabRef : undefined
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

                <DropdownMenuLabel className="border-b p-0">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search items..."
                      value={itemSearch}
                      onChange={handleItemSearchChange}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="h-9 w-full border-0 shadow-none pl-9 pr-3 bg-transparent focus-visible:ring-0"
                      disabled={isSubmitting || isLoadingInventory}
                    />
                  </div>
                </DropdownMenuLabel>

                <div className="max-h-80 overflow-y-auto pt-2">
                  {renderPicker()}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Selected items with per-item discount */}
          {saleDisplayItems.length > 0 && (
            <div className="space-y-2">
              {saleDisplayItems.map((item) => {
                const base = Number(item.inventory.pricePerBag || 0);
                const salePrice = previewSalePrice(
                  base,
                  item.discountType,
                  item.discountValue,
                );
                const dv = Number(item.discountValue);
                const invalid = !item.discountValue || dv <= 0 || dv > 100;
                return (
                  <div
                    key={item.inventoryItemId}
                    className="flex items-center gap-3 rounded-md border p-3"
                  >
                    {/* Thumbnail — hover to enlarge */}
                    <HoverCard openDelay={150} closeDelay={80}>
                      <HoverCardTrigger asChild>
                        <div className="shrink-0 cursor-zoom-in">
                          <CommonImage
                            src={item.inventory.image?.url}
                            alt={item.inventory.minifigName}
                            className="mx-auto w-16 aspect-4/3"
                            objectFit="object-contain"
                          />
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent>
                        <CommonImage
                          src={item.inventory.image?.url}
                          alt={item.inventory.minifigName}
                          className="w-80"
                          objectFit="object-contain"
                        />
                      </HoverCardContent>
                    </HoverCard>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm font-semibold line-clamp-1">
                        {item.inventory.minifigName}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground line-through">
                          {formatCurrency(base)}
                        </span>
                        <span className="font-bold text-destructive">
                          {formatCurrency(salePrice)}
                        </span>
                      </div>
                    </div>

                    {/* Discount control — percentage off only */}
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={item.discountValue}
                        onChange={(e) =>
                          handleItemDiscountValueChange(
                            item.inventoryItemId,
                            e.target.value,
                          )
                        }
                        disabled={isSubmitting}
                        className={`h-8 w-16 text-center ${
                          invalid ? "border-destructive" : ""
                        }`}
                      />
                      <span className="text-sm font-medium text-muted-foreground">
                        % off
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveItem(item.inventoryItemId)}
                      disabled={isSubmitting}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Enabled toggle */}
          <VisibilitySwitch
            id="isEnabled"
            label="Enabled"
            description="A sale only discounts prices when enabled AND inside its window. Disable to stage or pause it."
            checked={formData.isEnabled}
            onChange={handleValueChange("isEnabled")}
            disabled={isSubmitting}
          />
        </div>
      </AddUpdateItemDialog>

      {/* Delete Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemName={display(selectedItem?.name)}
        title="Delete Flash Sale"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default FlashSaleManagement;
