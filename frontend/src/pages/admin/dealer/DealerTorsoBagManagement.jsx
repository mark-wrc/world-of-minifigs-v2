import React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AdminManagementHeader from "@/components/shared/AdminManagementHeader";
import {
  AdminFormInput,
  AdminFormSelect,
} from "@/components/shared/AdminFormInput";
import VisibilitySwitch from "@/components/shared/VisibilitySwitch";
import TableLayout from "@/components/table/TableLayout";
import {
  ActionsColumn,
  TableCell,
  TimestampCells,
  StatusCell,
} from "@/components/table/BaseColumn";
import DeleteDialog from "@/components/table/DeleteDialog";
import AddUpdateItemDialog from "@/components/table/AddUpdateItemDialog";
import MediaUpload from "@/components/shared/MediaUpload";
import UploadProgress from "@/components/shared/UploadProgress";
import { display } from "@/utils/formatting";
import useDealerTorsoBagManagement from "@/hooks/admin/useDealerTorsoBagManagement";

const DealerTorsoBagManagement = () => {
  const {
    dialogOpen,
    deleteDialogOpen,
    selectedItem,
    dialogMode,
    formData,
    filePreview,
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
    uploadProgress,
    isDeleting,
    handleChange,
    handleValueChange,
    handleDialogClose,
    handleAdd,
    handleEdit,
    handleDelete,
    handleDealerTorsoBagFileChange,
    handleDealerTorsoBagFileRemove,
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
        description="Configure torso design bags for dealer bundles"
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
            {/* Bag Name */}
            <TableCell maxWidth="200px" className="font-medium">
              {display(bag.bagName)}
            </TableCell>

            {/* Base Size */}
            <TableCell>{bag.baseSize ? `${bag.baseSize}` : "—"}</TableCell>

            {/* Designs Count */}
            <TableCell>{bag.items?.length} Designs</TableCell>

            {/* Stock */}
            <TableCell>
              {bag.stock === 0 ? (
                <Badge variant="destructive">Out of Stock</Badge>
              ) : bag.stock < 50 ? (
                <Badge variant="accent">{bag.stock} remaining</Badge>
              ) : (
                <Badge variant="success">{bag.stock} available</Badge>
              )}
            </TableCell>

            {/* Status */}
            <StatusCell isActive={bag.isActive} />

            {/* Timestamps */}
            <TimestampCells
              createdAt={bag.createdAt}
              updatedAt={bag.updatedAt}
            />

            {/* Actions */}
            <ActionsColumn
              onEdit={() => handleEdit(bag)}
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
        className="sm:max-w-4xl"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Bag Name */}
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
            {/* Stock */}
            <AdminFormInput
              label="Stock"
              name="stock"
              type="number"
              min="0"
              placeholder="0"
              value={formData.stock}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            {/* Base Bag Size */}
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

          {/* Torso Designs Upload */}
          <MediaUpload
            label="Torso Designs Attachment"
            multiple
            previews={formData.items}
            onChange={handleDealerTorsoBagFileChange}
            onRemove={handleDealerTorsoBagFileRemove}
            accept="image/*"
            description="PNG, JPG, WEBP (Multiple)"
            disabled={isSubmitting}
            renderItem={(item, index) => (
              <div className="p-2 space-y-2">
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
                  disabled={isSubmitting}
                />
              </div>
            )}
          />

          {/* Upload progress (direct browser→Cloudinary) */}
          {uploadProgress.isUploading && (
            <UploadProgress
              done={uploadProgress.done}
              total={uploadProgress.total}
            />
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
