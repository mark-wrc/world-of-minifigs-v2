import React from "react";
import ColorSwatch from "@/components/shared/ColorSwatch";
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

const InventoryItemInputs = React.memo(
  ({
    item,
    index,
    colors,
    isLoadingColors,
    collections,
    isLoadingCollections,
    isMinifigsTab,
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
      {isMinifigsTab ? (
        <AdminFormInput
          name="pricePerBag"
          type="number"
          placeholder="Price"
          step="0.01"
          value={item.pricePerBag}
          onChange={onChange}
          disabled={isSubmitting}
          required
          inputClassName="h-8 text-xs"
        />
      ) : (
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
      )}

      <AdminFormInput
        name="stock"
        type="number"
        placeholder={isMinifigsTab ? "Stocks" : "Stocks/bag"}
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
    </div>
  ),
);

const GeneralInventoryManagement = () => {
  const {
    activeTab,
    setActiveTab,
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
            onClick={() => setActiveTab(tab.value)}
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
        searchPlaceholder="Search by name..."
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
        renderRow={(item) => (
          <>
            {/* Name */}
            <TableCell>{display(item.minifigName)}</TableCell>

            {/* Color */}
            <TableCell>
              <ColorSwatch
                color={item.colorId?.hexCode}
                label={display(item.colorId?.colorName)}
                className="justify-center"
              />
            </TableCell>

            {/* Collection — minifigs tab only */}
            {activeTab === "minifigs" && (
              <TableCell>
                {display(item.collectionId?.collectionName)}
              </TableCell>
            )}

            {/* Price per Bag */}
            <PriceCell amount={item.pricePerBag} />

            {/* Pieces per Bag — hidden for minifigs (sold individually) */}
            {activeTab !== "minifigs" && (
              <TableCell>{item.piecesPerBag ?? 1}</TableCell>
            )}

            {/* Stock (bags) */}
            <TableCell>{item.stock}</TableCell>

            {/* Status */}
            <StatusCell isActive={item.isActive} />

            {/* Timestamps */}
            <TimestampCells
              createdAt={item.createdAt}
              updatedAt={item.updatedAt}
            />

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
