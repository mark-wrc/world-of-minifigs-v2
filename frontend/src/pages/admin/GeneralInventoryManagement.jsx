import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  AdminFormMultiSelect,
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

// Inline-editable admin "cost" note. Click to enter a number; saved value shows
// as a green, bold, $-prefixed amount. Purely informational — no logic depends on it.
const CostCell = ({ item, onSave }) => {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(item.cost ?? "");

  React.useEffect(() => {
    setValue(item.cost ?? "");
  }, [item.cost]);

  const commit = () => {
    setEditing(false);
    const trimmed = String(value).trim();
    const next = trimmed === "" ? null : Number(trimmed);
    const current = item.cost ?? null;
    if (next === current) return;
    if (next !== null && (isNaN(next) || next < 0)) {
      setValue(item.cost ?? "");
      return;
    }
    onSave(item._id, next);
  };

  if (editing) {
    return (
      <TableCell>
        <input
          type="number"
          min="0"
          step="0.01"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue(item.cost ?? "");
              setEditing(false);
            }
          }}
          className="mx-auto block w-20 border-0 border-b border-foreground/50 bg-transparent px-1 py-0.5 text-center text-sm font-bold text-success focus:outline-none dark:text-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </TableCell>
    );
  }

  return (
    <TableCell>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Click to set cost"
        className="mx-auto block"
      >
        {item.cost != null ? (
          <span className="text-sm font-bold text-success dark:text-accent underline underline-offset-2">
            ${Number(item.cost).toFixed(2)}
          </span>
        ) : (
          <span className="inline-block w-20 border-b border-foreground/50">
            &nbsp;
          </span>
        )}
      </button>
    </TableCell>
  );
};

// Inline-editable admin "bin" note. Click to enter free-form text (location code).
// Purely informational — no logic depends on it.
const BinCell = ({ item, onSave }) => {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(item.bin ?? "");

  React.useEffect(() => {
    setValue(item.bin ?? "");
  }, [item.bin]);

  const commit = () => {
    setEditing(false);
    const trimmed = String(value).trim();
    const next = trimmed === "" ? null : trimmed;
    const current = item.bin ?? null;
    if (next === current) return;
    onSave(item._id, next);
  };

  if (editing) {
    return (
      <TableCell>
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue(item.bin ?? "");
              setEditing(false);
            }
          }}
          className="mx-auto block w-24 border-0 border-b border-foreground/50 bg-transparent px-1 py-0.5 text-center text-sm font-bold text-foreground focus:outline-none"
        />
      </TableCell>
    );
  }

  return (
    <TableCell>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Click to set bin"
        className="mx-auto block"
      >
        {item.bin ? (
          <span className="text-sm font-bold text-foreground underline underline-offset-2">
            {item.bin}
          </span>
        ) : (
          <span className="inline-block w-24 border-b border-foreground/50">
            &nbsp;
          </span>
        )}
      </button>
    </TableCell>
  );
};

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
        <AdminFormMultiSelect
          name="collectionIds"
          value={item.collectionIds}
          onValueChange={getValueChangeHandler("collectionIds", index)}
          triggerClassName="text-[11px]"
          options={collections}
          getValue={(c) => c._id}
          getLabel={(c) => c.collectionName}
          placeholder="Select Collections"
          isLoading={isLoadingCollections}
          disabled={isSubmitting}
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
    salesSort,
    handleStockFilterChange,
    handleStatusFilterChange,
    handleCollectionFilterChange,
    handlePartTypeFilterChange,
    handleSalesSortChange,
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
    handleCostSave,
    handleBinSave,
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

            <Select
              value={salesSort || "none"}
              onValueChange={handleSalesSortChange}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Sort by Sales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sort by Sales</SelectItem>
                <SelectItem value="sales-high">Highest Sales</SelectItem>
                <SelectItem value="sales-low">Lowest Sales</SelectItem>
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
            <TableCell>
              <div className="flex items-center justify-center gap-1.5">
                <span>{display(item.minifigName)}</span>
                {item.isFeatured && (
                  <Badge
                    variant="warning"
                    className="text-[10px] px-1.5 py-0 leading-4"
                  >
                    Featured
                  </Badge>
                )}
              </div>
            </TableCell>

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

            {/* Cost — inline-editable admin note */}
            <CostCell item={item} onSave={handleCostSave} />

            {/* Bin — inline-editable admin location note */}
            <BinCell item={item} onSave={handleBinSave} />

            {/* Price per Bag */}
            <PriceCell amount={item.pricePerBag} />

            {/* Pieces per Bag */}
            <TableCell>{item.piecesPerBag ?? 1}</TableCell>

            {/* Stock (bags) */}
            <StockCell stock={item.stock} suffix="bags" />

            {/* Sales — bags sold across orders */}
            <TableCell>{(item.soldBags ?? 0).toLocaleString()} sold</TableCell>

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
        className="sm:max-w-lg"
      >
        <div className="space-y-4">
          {/* Media Upload with Metadata Inputs */}
          <MediaUpload
            label="General Inventory Image"
            multiple={false}
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

          {/* Featured — surfaces the item under the "Featured" sort in the
              dealer add-on preview and shows a "Featured" badge. */}
          <VisibilitySwitch
            id="isFeatured"
            label="Add to Featured"
            checked={formData.isFeatured}
            onChange={handleValueChange("isFeatured")}
            disabled={isSubmitting}
            description="When enabled, this item appears under the featured items"
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
