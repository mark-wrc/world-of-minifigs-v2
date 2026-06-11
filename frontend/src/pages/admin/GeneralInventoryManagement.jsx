import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ColorSwatch from "@/components/shared/ColorSwatch";
import CommonImage from "@/components/shared/CommonImage";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import {
  AdminFormInput,
  AdminFormSelect,
} from "@/components/shared/AdminFormInput";
import AdminManagementHeader from "@/components/shared/AdminManagementHeader";
import TableLayout from "@/components/table/TableLayout";
import {
  ActionsColumn,
  TableCell,
  StatusCell,
  PriceCell,
  StockCell,
  TimestampCells,
} from "@/components/table/BaseColumn";
import VisibilitySwitch from "@/components/shared/VisibilitySwitch";
import AddUpdateItemDialog from "@/components/table/AddUpdateItemDialog";
import MediaUpload from "@/components/shared/MediaUpload";
import DeleteDialog from "@/components/table/DeleteDialog";
import { display } from "@/utils/formatting";
import useGeneralInventoryManagement, {
  INVENTORY_TABS,
} from "@/hooks/admin/useGeneralInventoryManagement";
import { BULK_MINIFIG_PART_TYPES } from "@shared/inventoryData";

const PART_TYPE_OPTIONS = BULK_MINIFIG_PART_TYPES.map((name) => ({
  value: name,
  label: name,
}));

const InventoryItemInputs = React.memo(
  ({
    item,
    index,
    colors,
    isLoadingColors,
    collections,
    isLoadingCollections,
    isMinifigsTab,
    isBulkPartsTab,
    isSubmitting,
    onChange,
    getValueChangeHandler,
  }) => (
    <div className="p-2 space-y-2">
      <AdminFormInput
        name="minifigName"
        type="text"
        placeholder="Enter Name"
        value={item.minifigName}
        onChange={onChange}
        disabled={isSubmitting}
        required
        inputClassName="h-8 text-xs"
      />

      <AdminFormInput
        name="itemId"
        type="text"
        placeholder="Item ID (optional)"
        value={item.itemId ?? ""}
        onChange={onChange}
        disabled={isSubmitting}
        inputClassName="h-8 text-xs"
      />
      <div className="grid grid-cols-2 gap-2">
        <AdminFormInput
          name="pricePerBag"
          type="number"
          placeholder="Bag Price"
          step="0.01"
          value={item.pricePerBag}
          onChange={onChange}
          disabled={isSubmitting}
          required
          inputClassName="h-8 text-xs"
        />

        <AdminFormInput
          name="piecesPerBag"
          type="number"
          placeholder="Qty/bag"
          min="1"
          step="1"
          value={item.piecesPerBag ?? ""}
          onChange={onChange}
          disabled={isSubmitting}
          inputClassName="h-8 text-xs"
        />
      </div>

      <AdminFormInput
        name="stock"
        type="number"
        placeholder="Stocks/bag"
        value={item.stock}
        onChange={onChange}
        disabled={isSubmitting}
        required
        inputClassName="h-8 text-xs"
      />

      <AdminFormSelect
        name="color"
        value={item.color}
        onValueChange={getValueChangeHandler("color", index)}
        triggerClassName="text-[11px]"
        options={colors}
        getValue={(color) => color._id}
        getLabel={(color) => color.colorName}
        renderOption={(color) => (
          <ColorSwatch color={color.hexCode} label={color.colorName} />
        )}
        placeholder="Select Color"
        isLoading={isLoadingColors}
        disabled={isSubmitting}
      />

      {isMinifigsTab && (
        <AdminFormSelect
          name="collectionId"
          value={item.collectionId}
          onValueChange={getValueChangeHandler("collectionId", index)}
          triggerClassName="text-[11px]"
          options={collections}
          getValue={(c) => c._id}
          getLabel={(c) => c.collectionName}
          placeholder="Select Collection"
          isLoading={isLoadingCollections}
          disabled={isSubmitting}
          required
        />
      )}

      {isBulkPartsTab && (
        <AdminFormSelect
          name="partType"
          value={item.partType}
          onValueChange={getValueChangeHandler("partType", index)}
          triggerClassName="text-[11px]"
          options={PART_TYPE_OPTIONS}
          placeholder="Select Part Type"
          disabled={isSubmitting}
          required
        />
      )}
    </div>
  ),
);

const GeneralInventoryManagement = () => {
  const {
    activeTab,
    handleTabChange,
    stockFilter,
    statusFilter,
    collectionFilter,
    partTypeFilter,
    handleStockFilterChange,
    handleStatusFilterChange,
    handleCollectionFilterChange,
    handlePartTypeFilterChange,
    inventory,
    colors,
    collections,
    isLoadingInventory,
    isLoadingColors,
    isLoadingCollections,
    isSubmitting,
    isDeleting,
    filePreview,
    handleInventoryFileChange,
    handleInventoryFileRemove,
    getItemChangeHandler,
    dialogOpen,
    dialogMode,
    formData,
    handleDialogClose,
    handleEdit,
    handleSubmit,
    handleDelete,
    handleConfirmDelete,
    deleteDialogOpen,
    setDeleteDialogOpen,
    selectedItem,
    page,
    limit,
    search,
    totalItems,
    totalPages,
    startItem,
    endItem,
    columns,
    handlePageChange,
    handleLimitChange,
    handleSearchChange,
    handlePrevious,
    handleNext,
    handleAdd,
    handleValueChange,
  } = useGeneralInventoryManagement();

  return (
    <div className="space-y-5">
      {/* Admin Page Header */}
      <AdminManagementHeader
        title="General Inventory"
        description="Manage your general stock and bulk upload new items"
        actionLabel="Add Inventory"
        onAction={handleAdd}
      />

      {/* Category Tabs */}
      <div className="flex gap-2 border-b">
        {INVENTORY_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleTabChange(tab.value)}
            className={[
              "px-4 py-2 text-sm font-medium transition-colors cursor-pointer",
              activeTab === tab.value
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table Layout */}
      <TableLayout
        searchPlaceholder="Search item..."
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
        data={inventory}
        isLoading={isLoadingInventory}
        searchExtra={
          <>
            <Select
              value={stockFilter || "all"}
              onValueChange={handleStockFilterChange}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="in">In Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter || "all"}
              onValueChange={handleStatusFilterChange}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            {activeTab === "minifigs" && (
              <Select
                value={collectionFilter || "all"}
                onValueChange={handleCollectionFilterChange}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Collections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Collections</SelectItem>
                  {collections.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.collectionName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {activeTab === "bulk-minifig-parts" && (
              <Select
                value={partTypeFilter || "all"}
                onValueChange={handlePartTypeFilterChange}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Part Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Part Types</SelectItem>
                  {PART_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        }
        renderRow={(item) => (
          <>
            {/* Thumbnail — hover to enlarge */}
            <TableCell>
              <HoverCard openDelay={150} closeDelay={80}>
                <HoverCardTrigger asChild>
                  <div className="shrink-0 cursor-zoom-in">
                    <CommonImage
                      src={item.image?.url}
                      alt={item.minifigName}
                      className="mx-auto w-20 aspect-4/3"
                      objectFit="object-contain"
                    />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent>
                  <CommonImage
                    src={item.image?.url}
                    alt={item.minifigName}
                    className="w-80"
                    objectFit="object-contain"
                  />
                </HoverCardContent>
              </HoverCard>
            </TableCell>

            {/* Name */}
            <TableCell>{display(item.minifigName)}</TableCell>

            {/* Item ID */}
            <TableCell>{display(item.itemId)}</TableCell>

            {/* Color */}
            <TableCell>
              <ColorSwatch
                color={item.colorId?.hexCode}
                label={display(item.colorId?.colorName)}
                className="justify-center"
              />
            </TableCell>

            {/* Price per Bag */}
            <PriceCell amount={item.pricePerBag} />

            {/* Pieces per Bag */}
            <TableCell>{item.piecesPerBag ?? 1}</TableCell>

            {/* Stock (bags) */}
            <StockCell stock={item.stock} suffix="bags" />

            {/* Status */}
            <StatusCell isActive={item.isActive} />

            {/* Updated At */}
            <TimestampCells updatedAt={item.updatedAt} />

            {/* Actions */}
            <ActionsColumn
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item)}
            />
          </>
        )}
      />

      {/* Add / Update Dialog */}
      <AddUpdateItemDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        mode={dialogMode}
        entityName="Inventory"
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        className={dialogMode === "add" ? "sm:max-w-5xl" : ""}
      >
        <div className="space-y-4">
          {/* Media Upload with Metadata Inputs */}
          <MediaUpload
            label="General Inventory Image"
            multiple={dialogMode === "add"}
            previews={filePreview}
            preview={filePreview[0]?.url}
            onChange={handleInventoryFileChange}
            onRemove={handleInventoryFileRemove}
            accept="image/*"
            description="PNG, JPG, WEBP"
            disabled={isSubmitting}
            renderItem={(item, index) => (
              <InventoryItemInputs
                item={item}
                index={index}
                colors={colors}
                isLoadingColors={isLoadingColors}
                collections={collections}
                isLoadingCollections={isLoadingCollections}
                isMinifigsTab={activeTab === "minifigs"}
                isBulkPartsTab={activeTab === "bulk-minifig-parts"}
                isSubmitting={isSubmitting}
                onChange={getItemChangeHandler(index)}
                getValueChangeHandler={handleValueChange}
              />
            )}
          />

          {/* Visibility */}
          <VisibilitySwitch
            checked={formData.isActive}
            onChange={handleValueChange("isActive")}
            disabled={isSubmitting}
            description="When disabled, this item will be hidden from the admin add-ons page."
          />
        </div>
      </AddUpdateItemDialog>

      {/* Delete Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemName={display(selectedItem?.minifigName)}
        title="Delete Inventory"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default GeneralInventoryManagement;
