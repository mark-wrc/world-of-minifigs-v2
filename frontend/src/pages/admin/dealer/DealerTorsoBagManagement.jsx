import React from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AdminManagementHeader from "@/components/shared/AdminManagementHeader";
import {
  AdminFormInput,
  AdminFormNumberInput,
  AdminFormSelect,
} from "@/components/shared/AdminFormInput";
import VisibilitySwitch from "@/components/shared/VisibilitySwitch";
import ColorSwatch from "@/components/shared/ColorSwatch";
import CommonImage from "@/components/shared/CommonImage";
import TableLayout from "@/components/table/TableLayout";
import {
  ActionsColumn,
  TableCell,
  TimestampCells,
  StatusCell,
} from "@/components/table/BaseColumn";
import DeleteDialog from "@/components/table/DeleteDialog";
import AddUpdateItemDialog from "@/components/table/AddUpdateItemDialog";
import { display } from "@/utils/formatting";
import useDealerTorsoBagManagement from "@/hooks/admin/useDealerTorsoBagManagement";

// A single torso row inside the picker dropdown.
const TorsoDropdownItem = ({ inv, checked, onCheckedChange }) => (
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
    </div>
  </DropdownMenuCheckboxItem>
);

const DealerTorsoBagManagement = () => {
  const {
    dialogOpen,
    deleteDialogOpen,
    selectedItem,
    dialogMode,
    formData,
    page,
    limit,
    search,
    bags,
    totalItems,
    totalPages,
    startItem,
    endItem,
    columns,
    baseSizeOptions,
    adminTarget,
    miscQuantity,
    currentTotal,
    isLoadingBags,
    isSubmitting,
    isDeleting,
    groupedTorsoItems,
    selectedItemIds,
    isLoadingInventory,
    itemSearch,
    handleItemSearchChange,
    handleToggleTorso,
    handleRemoveItemAt,
    handleChange,
    handleValueChange,
    handleDialogClose,
    handleAdd,
    handleEdit,
    handleDuplicate,
    handleDelete,
    handleUpdateItemQuantity,
    handleSubmit,
    handleConfirmDelete,
    handlePageChange,
    handleLimitChange,
    handleSearchChange,
    handlePrevious,
    handleNext,
    setDeleteDialogOpen,
  } = useDealerTorsoBagManagement();

  return (
    <div className="space-y-5">
      {/* Admin Page Header */}
      <AdminManagementHeader
        title="Torso Bag Management"
        description="Build torso bags by selecting torsos from inventory — no image re-uploads"
        actionLabel="Add Bag"
        onAction={handleAdd}
      />

      {/* Table Layout */}
      <TableLayout
        searchPlaceholder="Search bags..."
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
        data={bags}
        isLoading={isLoadingBags}
        renderRow={(bag) => (
          <>
            <TableCell maxWidth="200px" className="font-medium">
              {display(bag.bagName)}
            </TableCell>
            <TableCell>{bag.baseSize ? `${bag.baseSize}` : "—"}</TableCell>
            <TableCell>{bag.items?.length} Designs</TableCell>
            <TableCell>
              {bag.stock === 0 ? (
                <Badge variant="destructive">Out of Stock</Badge>
              ) : bag.stock < 50 ? (
                <Badge variant="accent">{bag.stock} remaining</Badge>
              ) : (
                <Badge variant="success">{bag.stock} available</Badge>
              )}
            </TableCell>
            <StatusCell isActive={bag.isActive} />
            <TimestampCells
              createdAt={bag.createdAt}
              updatedAt={bag.updatedAt}
            />
            <ActionsColumn
              onEdit={() => handleEdit(bag)}
              onDuplicate={() => handleDuplicate(bag)}
              onDelete={() => handleDelete(bag)}
            />
          </>
        )}
      />

      {/* Add/Update Dialog */}
      <AddUpdateItemDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        mode={dialogMode}
        entityName="Torso Bag"
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        className="sm:max-w-5xl"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <AdminFormInput
              label="Bag Name"
              name="bagName"
              placeholder="Bag 1001"
              value={formData.bagName}
              onChange={handleChange}
              disabled={isSubmitting}
              className="col-span-2"
              required
            />
            <AdminFormNumberInput
              label="Stock"
              name="stock"
              placeholder="0"
              value={formData.stock}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            <AdminFormSelect
              label="Base Size"
              name="baseSize"
              value={formData.baseSize.toString()}
              onValueChange={(v) => handleValueChange("baseSize")(Number(v))}
              options={baseSizeOptions}
              getValue={(item) => item.value.toString()}
              getLabel={(item) => item.label}
              placeholder="Base"
              disabled={isSubmitting}
            />
          </div>

          {/* Torso Picker */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">Select Torsos</h4>
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
                  Add torsos from inventory
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                <DropdownMenuLabel className="border-b p-0">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search torsos..."
                      value={itemSearch}
                      onChange={handleItemSearchChange}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="h-9 w-full border-0 shadow-none pl-9 pr-3 bg-transparent focus-visible:ring-0"
                      disabled={isSubmitting || isLoadingInventory}
                    />
                  </div>
                </DropdownMenuLabel>

                <div className="max-h-88 overflow-y-auto pt-2">
                  {isLoadingInventory ? (
                    <div className="p-2 text-sm text-center text-muted-foreground">
                      Loading...
                    </div>
                  ) : groupedTorsoItems.length === 0 ? (
                    <div className="p-2 text-sm text-center text-muted-foreground">
                      No torsos found
                    </div>
                  ) : (
                    groupedTorsoItems.map((group) => (
                      <div key={group.partType}>
                        <div className="p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {group.partType}
                        </div>
                        {group.items.map((inv) => (
                          <TorsoDropdownItem
                            key={inv._id}
                            inv={inv}
                            checked={selectedItemIds.has(inv._id)}
                            onCheckedChange={() => handleToggleTorso(inv)}
                          />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Selected torsos with per-item quantity */}
          {formData.items.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {formData.items.map((item, index) => {
                const inv = item._item;
                const imageUrl = inv?.image?.url || item.legacyImage?.url;
                const needsRelink = !item.inventoryItemId;
                return (
                  <div
                    key={item.inventoryItemId || `legacy-${index}`}
                    className={`relative rounded-md border p-2 space-y-2 ${
                      needsRelink ? "border-destructive" : ""
                    }`}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 size-6 text-destructive hover:text-destructive z-10"
                      onClick={() => handleRemoveItemAt(index)}
                      disabled={isSubmitting}
                    >
                      <X className="size-4" />
                    </Button>

                    <div className="overflow-hidden rounded">
                      <CommonImage
                        src={imageUrl}
                        alt={inv?.minifigName || "Torso"}
                        className="w-full h-full"
                      />
                    </div>

                    {needsRelink ? (
                      <Badge
                        variant="destructive"
                        className="w-full justify-center uppercase text-[9px]"
                      >
                        Re-link required
                      </Badge>
                    ) : (
                      <p className="text-xs font-bold line-clamp-1">
                        {inv?.minifigName || "Torso"}
                      </p>
                    )}

                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Quantity
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="1"
                        value={item.quantity}
                        onChange={handleUpdateItemQuantity(index)}
                        className="h-9 text-xs"
                        disabled={isSubmitting || needsRelink}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quantity Summary */}
          <div className="p-4 rounded-lg border flex">
            <div className="space-y-2 flex-1 text-sm">
              <div className="flex items-center gap-1">
                <span className="font-bold text-lg">{currentTotal}</span>
                <span className="opacity-50">/</span>
                <span className="font-bold">{adminTarget}</span>
                <span className="text-xs ml-1">designs configured</span>

                {currentTotal === adminTarget ? (
                  <Badge variant="success" className="ml-auto">
                    MATCHED
                  </Badge>
                ) : currentTotal > adminTarget ? (
                  <Badge variant="destructive" className="ml-auto">
                    {currentTotal - adminTarget} EXCEEDED
                  </Badge>
                ) : (
                  <Badge variant="warning" className="ml-auto">
                    {adminTarget - currentTotal} REMAINING
                  </Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                * Designs must total {adminTarget} + {miscQuantity} mystery ={" "}
                {adminTarget + miscQuantity} per base bag.
              </p>
            </div>
          </div>

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
        itemName={display(selectedItem?.bagName)}
        title="Delete Torso Bag"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default DealerTorsoBagManagement;
