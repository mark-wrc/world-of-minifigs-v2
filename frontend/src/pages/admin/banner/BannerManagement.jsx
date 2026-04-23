import React from "react";
import AdminManagementHeader from "@/components/shared/AdminManagementHeader";
import TableLayout from "@/components/table/TableLayout";
import {
  AdminFormInput,
  AdminFormTextarea,
  AdminFormSelect,
} from "@/components/shared/AdminFormInput";
import VisibilitySwitch from "@/components/shared/VisibilitySwitch";
import {
  ActionsColumn,
  TableCell,
  TimestampCells,
  StatusCell,
} from "@/components/table/BaseColumn";
import AddUpdateItemDialog from "@/components/table/AddUpdateItemDialog";
import MediaUpload from "@/components/shared/MediaUpload";
import DeleteDialog from "@/components/table/DeleteDialog";
import BannerPreview from "@/pages/admin/banner/BannerPreview";
import BannerButtonFields from "@/pages/admin/banner/BannerButtonFields";
import HighlightText from "@/components/shared/HighlightText";
import { display } from "@/utils/formatting";
import useBannerManagement from "@/hooks/admin/useBannerManagement";

const BannerManagement = () => {
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
    banners,
    totalItems,
    totalPages,
    startItem,
    endItem,
    handlePrevious,
    handleNext,
    handlePageChange,
    handleLimitChange,
    handleSearchChange,
    columns,
    isLoadingBanners,
    isSubmitting,
    isDeleting,
    handleChange,
    handleValueChange,
    handleNestedChange,
    handleBannerFileChange,
    handleBannerFileRemove,
    handleSubmit,
    handleDialogClose,
    handleAdd,
    handleEdit,
    handleDelete,
    handleConfirmDelete,
    setDeleteDialogOpen,
  } = useBannerManagement();

  return (
    <div className="space-y-5">
      {/* Admin Page Header */}
      <AdminManagementHeader
        title="Banner Management"
        description="Manage homepage banners"
        actionLabel="Add Banner"
        onAction={handleAdd}
      />

      {/* Table Layout */}
      <TableLayout
        searchPlaceholder="Search banners..."
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
        data={banners}
        isLoading={isLoadingBanners}
        renderRow={(banner) => (
          <>
            {/*  Badge */}
            <TableCell>
              {banner.badge ? <HighlightText text={banner.badge} /> : "-"}
            </TableCell>

            {/*  Label */}
            <TableCell maxWidth="200px">
              {banner.label ? <HighlightText text={banner.label} /> : "-"}
            </TableCell>

            {/*  Order */}
            <TableCell>{display(banner.order)}</TableCell>

            {/*  Position */}
            <TableCell>
              <span className="capitalize">{display(banner.position)}</span>
            </TableCell>

            {/* Status */}
            <StatusCell isActive={banner.isActive} />

            {/*  Timestamps */}
            <TimestampCells
              createdAt={banner.createdAt}
              updatedAt={banner.updatedAt}
            />

            {/*  Actions */}
            <ActionsColumn
              onEdit={() => handleEdit(banner)}
              onDelete={() => handleDelete(banner)}
            />
          </>
        )}
      />

      {/* Add/Update Dialog */}
      <AddUpdateItemDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        mode={dialogMode}
        entityName="Banner"
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        className="sm:max-w-4xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-3">
            {/* Badge */}
            <AdminFormInput
              label="Badge"
              name="badge"
              placeholder="New Arrival"
              value={formData.badge}
              onChange={handleChange}
              disabled={isSubmitting}
              className="col-span-2"
            />

            {/* Label */}
            <AdminFormInput
              label="Label"
              name="label"
              placeholder="Banner Label"
              value={formData.label}
              onChange={handleChange}
              required
              disabled={isSubmitting}
              className="col-span-2"
            />

            {/* Order */}
            <AdminFormInput
              label="Order"
              name="order"
              type="number"
              min="1"
              placeholder="1"
              value={formData.order}
              onChange={handleChange}
              required
              disabled={isSubmitting}
              className="col-span-1"
            />
          </div>

          {/* Description */}
          <AdminFormTextarea
            label="Description"
            name="description"
            placeholder="Enter banner description..."
            value={formData.description}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />

          <div className="grid grid-cols-2 gap-3">
            <AdminFormSelect
              label="Text Position"
              name="position"
              value={formData.position}
              onValueChange={handleValueChange("position")}
              options={[
                { value: "center", label: "Center" },
                { value: "bottom-left", label: "Bottom Left" },
                { value: "bottom-right", label: "Bottom Right" },
              ]}
              placeholder="Select position"
              isLoading={isLoadingBanners}
              disabled={isSubmitting}
            />

            <AdminFormSelect
              label="Text Theme"
              name="textTheme"
              value={formData.textTheme}
              onValueChange={handleValueChange("textTheme")}
              options={[
                { value: "light", label: "Light Text" },
                { value: "dark", label: "Dark Text" },
              ]}
              placeholder="Select text theme"
              isLoading={isLoadingBanners}
              disabled={isSubmitting}
            />
          </div>

          {/* Visibility */}
          <VisibilitySwitch
            checked={formData.isActive}
            onChange={handleValueChange("isActive")}
            disabled={isSubmitting}
          />

          {/* Media Section */}
          <MediaUpload
            label="Banner Attachment"
            preview={filePreview}
            mediaType={formData.mediaType}
            onChange={handleBannerFileChange}
            onRemove={handleBannerFileRemove}
            accept="image/*,video/*"
            description="Image, GIF, or Video (max 10s)"
            disabled={isSubmitting}
          >
            {/* Banner Preview */}
            {filePreview && <BannerPreview formData={formData} />}
          </MediaUpload>

          {/* Buttons */}
          <BannerButtonFields
            formData={formData}
            isSubmitting={isSubmitting}
            handleValueChange={handleValueChange}
            handleNestedChange={handleNestedChange}
          />
        </div>
      </AddUpdateItemDialog>

      {/* Delete Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemName={display(selectedItem?.label)}
        title="Delete Banner"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default BannerManagement;
