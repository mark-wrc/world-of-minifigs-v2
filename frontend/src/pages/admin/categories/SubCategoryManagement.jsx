import React, { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TableLayout from "@/components/table/TableLayout";
import { ActionsColumn, TableCell } from "@/components/table/BaseColumn";
import AddUpdateItemDialog from "@/components/table/AddUpdateItemDialog";
import DeleteDialog from "@/components/table/DeleteDialog";
import {
  useGetSubCategoriesQuery,
  useCreateSubCategoryMutation,
  useUpdateSubCategoryMutation,
  useDeleteSubCategoryMutation,
  useGetCategoriesQuery,
} from "@/redux/api/adminApi";

const SubCategoryManagement = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSubCategory, setSelectedSubCategory] = useState(null);
  const [dialogMode, setDialogMode] = useState("add"); // "add" or "edit"
  const [formData, setFormData] = useState({
    subCategoryName: "",
    description: "",
    category: "",
  });

  // Fetch data
  const { data: subCategoriesData, isLoading: isLoadingSubCategories } =
    useGetSubCategoriesQuery();
  const { data: categoriesData, isLoading: isLoadingCategories } =
    useGetCategoriesQuery();

  // Mutations
  const [createSubCategory, { isLoading: isCreating }] =
    useCreateSubCategoryMutation();
  const [updateSubCategory, { isLoading: isUpdating }] =
    useUpdateSubCategoryMutation();
  const [deleteSubCategory, { isLoading: isDeleting }] =
    useDeleteSubCategoryMutation();

  // Calculate total items for TableLayout
  const totalItems =
    subCategoriesData?.count || subCategoriesData?.subCategories?.length || 0;

  // Displayed data - TableLayout handles pagination and search
  const displayedSubCategories = subCategoriesData?.subCategories || [];

  // Get categories list
  const categories = categoriesData?.categories || [];

  // Column definitions based on SubCategory model
  const columns = [
    { key: "subCategoryName", label: "Sub-category" },
    { key: "category", label: "Category" },
    { key: "description", label: "Description" },
    { key: "createdAt", label: "Created At" },
    { key: "updatedAt", label: "Updated At" },
    { key: "actions", label: "Actions" },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCategoryChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      category: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!formData.subCategoryName.trim()) {
      toast.error("Sub-category name is required", {
        description: "Please enter a sub-category name.",
      });
      return;
    }

    if (!formData.category) {
      toast.error("Category is required", {
        description: "Please select a parent category.",
      });
      return;
    }

    try {
      const subCategoryData = {
        subCategoryName: formData.subCategoryName.trim(),
        description: formData.description.trim(),
        category: formData.category,
      };

      if (dialogMode === "edit" && selectedSubCategory) {
        // Update existing sub-category
        const subCategoryId = selectedSubCategory._id || selectedSubCategory.id;
        const response = await updateSubCategory({
          id: subCategoryId,
          ...subCategoryData,
        }).unwrap();

        if (response.success) {
          toast.success(
            response.message || "Sub-category updated successfully",
            {
              description: `The sub-category "${response.subCategory.subCategoryName}" has been updated.`,
            }
          );

          // Reset form and close dialog
          setFormData({
            subCategoryName: "",
            description: "",
            category: "",
          });
          setSelectedSubCategory(null);
          setDialogMode("add");
          setDialogOpen(false);
        }
      } else {
        // Create new sub-category
        const response = await createSubCategory(subCategoryData).unwrap();

        if (response.success) {
          toast.success(
            response.message || "Sub-category created successfully",
            {
              description: `The sub-category "${response.subCategory.subCategoryName}" has been created.`,
            }
          );

          // Reset form and close dialog
          setFormData({
            subCategoryName: "",
            description: "",
            category: "",
          });
          setDialogOpen(false);
        }
      }
    } catch (error) {
      console.error(
        `${dialogMode === "edit" ? "Update" : "Create"} sub-category error:`,
        error
      );
      toast.error(
        error?.data?.message ||
          `Failed to ${
            dialogMode === "edit" ? "update" : "create"
          } sub-category`,
        {
          description:
            error?.data?.description ||
            "An unexpected error occurred. Please try again.",
        }
      );
    }
  };

  const handleDialogClose = (open) => {
    setDialogOpen(open);
    if (!open) {
      // Reset form and mode when dialog closes
      setFormData({
        subCategoryName: "",
        description: "",
        category: "",
      });
      setSelectedSubCategory(null);
      setDialogMode("add");
    }
  };

  const handleAdd = () => {
    setDialogMode("add");
    setSelectedSubCategory(null);
    setFormData({
      subCategoryName: "",
      description: "",
      category: "",
    });
    setDialogOpen(true);
  };

  const handleEdit = (subCategory) => {
    setDialogMode("edit");
    setSelectedSubCategory(subCategory);
    setFormData({
      subCategoryName: subCategory.subCategoryName || "",
      description: subCategory.description || "",
      category: subCategory.categoryId?._id || subCategory.categoryId || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (subCategory) => {
    setSelectedSubCategory(subCategory);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedSubCategory) return;

    try {
      const subCategoryId = selectedSubCategory._id || selectedSubCategory.id;
      const response = await deleteSubCategory(subCategoryId).unwrap();

      toast.success(response.message || "SubCategory deleted successfully", {
        description: `The sub-category "${selectedSubCategory.subCategoryName}" has been removed.`,
      });

      setDeleteDialogOpen(false);
      setSelectedSubCategory(null);
    } catch (error) {
      console.error("Delete sub-category error:", error);
      toast.error(error?.data?.message || "Failed to delete sub-category", {
        description:
          error?.data?.description ||
          "An unexpected error occurred. Please try again.",
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sub-category Management</h1>
          <p className="text-sm text-popover-foreground/80 mt-2">
            Manage product sub-categories in your store
          </p>
        </div>
        <Button variant="accent" onClick={handleAdd}>
          <Plus className="size-4" />
          Add Sub-category
        </Button>
      </div>

      <TableLayout
        searchPlaceholder="Search subcategories..."
        totalItems={totalItems}
        columns={columns}
        data={displayedSubCategories}
        isLoading={isLoadingSubCategories}
        loadingMessage="Loading subcategories..."
        emptyMessage="No sub-category found..."
        searchFields={[
          "subCategoryName",
          "description",
          "categoryId.categoryName",
        ]}
        renderRow={(subCategory) => (
          <>
            <TableCell maxWidth="200px">
              {subCategory.subCategoryName}
            </TableCell>
            <TableCell maxWidth="200px">
              {subCategory.categoryId?.categoryName || "-"}
            </TableCell>
            <TableCell maxWidth="300px">
              {subCategory.description || "-"}
            </TableCell>
            <TableCell>
              {subCategory.createdAt
                ? new Date(subCategory.createdAt).toLocaleString()
                : "-"}
            </TableCell>
            <TableCell>
              {subCategory.updatedAt
                ? new Date(subCategory.updatedAt).toLocaleString()
                : "-"}
            </TableCell>
            <ActionsColumn
              onEdit={() => handleEdit(subCategory)}
              onDelete={() => handleDelete(subCategory)}
            />
          </>
        )}
      />

      {/* Add/Edit Sub-category Dialog */}
      <AddUpdateItemDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        mode={dialogMode}
        title={
          dialogMode === "edit" ? "Edit Sub-category" : "Add New Sub-category"
        }
        description={
          dialogMode === "edit"
            ? "Update the sub-category details."
            : "Create a new sub-category for your products."
        }
        onSubmit={handleSubmit}
        isLoading={dialogMode === "edit" ? isUpdating : isCreating}
        submitButtonText={
          dialogMode === "edit" ? "Update Sub-category" : "Create Sub-category"
        }
      >
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={formData.category}
            onValueChange={handleCategoryChange}
            disabled={dialogMode === "edit" ? isUpdating : isCreating}
          >
            <SelectTrigger id="category" className="w-full">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingCategories ? (
                <SelectItem value="loading" disabled>
                  Loading categories...
                </SelectItem>
              ) : categories.length === 0 ? (
                <SelectItem value="empty" disabled>
                  No categories available
                </SelectItem>
              ) : (
                categories.map((category) => (
                  <SelectItem
                    key={category._id || category.id}
                    value={category._id || category.id}
                  >
                    {category.categoryName}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subCategoryName">Sub-category Name</Label>
          <Input
            id="subCategoryName"
            name="subCategoryName"
            type="text"
            placeholder="e.g., Cars, Trucks, Houses"
            value={formData.subCategoryName}
            onChange={handleChange}
            required
            disabled={dialogMode === "edit" ? isUpdating : isCreating}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Enter sub-category description (optional)"
            value={formData.description}
            onChange={handleChange}
            disabled={dialogMode === "edit" ? isUpdating : isCreating}
            rows={4}
          />
        </div>
      </AddUpdateItemDialog>

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemName={selectedSubCategory?.subCategoryName || ""}
        title="Delete Sub-category"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default SubCategoryManagement;
