import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import AdminManagementHeader from "@/components/shared/AdminManagementHeader";
import {
  AdminFormInput,
  AdminFormTextarea,
  AdminFormSelect,
} from "@/components/shared/AdminFormInput";
import VisibilitySwitch from "@/components/shared/VisibilitySwitch";
import TableLayout from "@/components/table/TableLayout";
import {
  ActionsColumn,
  TableCell,
  TimestampCells,
  StatusCell,
  PriceCell,
} from "@/components/table/BaseColumn";
import DeleteDialog from "@/components/table/DeleteDialog";
import AddUpdateItemDialog from "@/components/table/AddUpdateItemDialog";
import { formatCurrency, display } from "@/utils/formatting";
import useDealerBundleManagement from "@/hooks/admin/useDealerBundleManagement";

const DealerBundleManagement = () => {
  const {
    dialogOpen,
    deleteDialogOpen,
    selectedItem,
    dialogMode,
    formData,
    page,
    limit,
    search,
    bundles,
    totalItems,
    totalPages,
    startItem,
    endItem,
    calculatedTotal,
    columns,
    isLoadingBundles,
    isSubmitting,
    isDeleting,
    handleChange,
    handleValueChange,
    handleDialogClose,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSubmit,
    handleConfirmDelete,
    handlePageChange,
    handleLimitChange,
    handleSearchChange,
    handlePrevious,
    handleNext,
    setDeleteDialogOpen,
    handleArrayChange,
    addArrayItem,
    removeArrayItem,
  } = useDealerBundleManagement();

  return (
    <div className="space-y-5">
      {/* Admin Page Header */}
      <AdminManagementHeader
        title="Dealer Bundles"
        description="Manage bulk packs and pricing steps"
        actionLabel="Add Bundle"
        onAction={handleAdd}
      />

      {/* Table Layout */}
      <TableLayout
        searchPlaceholder="Search bundles..."
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
        data={bundles}
        isLoading={isLoadingBundles}
        renderRow={(bundle) => (
          <>
            {/* Bundle Name */}
            <TableCell maxWidth="200px">{display(bundle.bundleName)}</TableCell>

            {/* Base Bag Size */}
            <TableCell>
              {bundle.baseSize ? `${bundle.baseSize}` : "—"}
            </TableCell>

            {/* Quantity */}
            <TableCell>{bundle.minifigQuantity}</TableCell>

            {/* Unit Price */}
            <TableCell>{formatCurrency(bundle.unitPrice)}</TableCell>

            {/* Total Price */}
            <PriceCell amount={bundle.totalPrice} />

            {/* Status */}
            <StatusCell isActive={bundle.isActive} />

            {/* Timestamps */}
            <TimestampCells
              createdAt={bundle.createdAt}
              updatedAt={bundle.updatedAt}
            />

            {/* Actions */}
            <ActionsColumn
              onEdit={() => handleEdit(bundle)}
              onDelete={() => handleDelete(bundle)}
            />
          </>
        )}
      />

      {/* Add/Update Dialog */}
      <AddUpdateItemDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        mode={dialogMode}
        entityName="Bundle"
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        className="sm:max-w-2xl"
      >
        <div className="space-y-4">
          {/* Bundle Name */}
          <AdminFormInput
            label="Bundle Name"
            name="bundleName"
            placeholder="100 Minifigs"
            value={formData.bundleName}
            onChange={handleChange}
            disabled={isSubmitting}
            required
          />

          {/* Description */}
          <AdminFormTextarea
            label="Description"
            name="description"
            placeholder="Enter bundle description..."
            value={formData.description}
            onChange={handleChange}
            disabled={isSubmitting}
          />

          <div className="grid grid-cols-3 gap-2">
            {/* Quantity */}
            <AdminFormInput
              label="Quantity"
              name="minifigQuantity"
              type="number"
              placeholder="100"
              value={formData.minifigQuantity}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            />

            {/* Unit Price */}
            <AdminFormInput
              label="Unit Price"
              name="unitPrice"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.unitPrice}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            />

            <AdminFormSelect
              label="Base Size"
              name="baseSize"
              value={formData.baseSize.toString()}
              onValueChange={(v) => handleValueChange("baseSize")(Number(v))}
              options={[
                { value: "100", label: "100" },
                { value: "500", label: "500" },
              ]}
              placeholder="Select base"
              disabled={isSubmitting}
            />
          </div>

          {/* Features */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="feature-0">Features</Label>
              {formData.features.length < 5 && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="px-0 h-auto"
                  onClick={addArrayItem("features")}
                >
                  Add Feature
                </Button>
              )}
            </div>

            {formData.features.map((feature, index) => (
              <div key={index} className="flex gap-2 items-start">
                <AdminFormTextarea
                  name={`feature-${index}`}
                  placeholder="Enter bundle features..."
                  value={feature}
                  onChange={handleArrayChange("features", index)}
                  className="flex-1"
                  disabled={isSubmitting}
                />
                {formData.features.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={removeArrayItem("features", index)}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Calculated Total */}
          <div className="flex justify-between items-center text-sm font-semibold pt-3">
            <span>Calculated Total Cost:</span>
            <span className="text-lg text-success dark:text-accent">
              {formatCurrency(calculatedTotal)}
            </span>
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
        itemName={display(selectedItem?.bundleName)}
        title="Delete Bundle"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default DealerBundleManagement;
