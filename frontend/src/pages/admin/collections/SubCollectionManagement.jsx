import React, { useState, useRef } from "react";
import { Plus, Upload, X } from "lucide-react";
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
  useGetSubCollectionsQuery,
  useCreateSubCollectionMutation,
  useUpdateSubCollectionMutation,
  useDeleteSubCollectionMutation,
  useGetCollectionsQuery,
} from "@/redux/api/adminApi";

const SubCollectionManagement = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSubCollection, setSelectedSubCollection] = useState(null);
  const [dialogMode, setDialogMode] = useState("add"); // "add" or "edit"
  const [formData, setFormData] = useState({
    subCollectionName: "",
    description: "",
    collection: "",
    image: null,
  });
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch data
  const { data: subCollectionsData, isLoading: isLoadingSubCollections } =
    useGetSubCollectionsQuery();
  const { data: collectionsData, isLoading: isLoadingCollections } =
    useGetCollectionsQuery();

  // Mutations
  const [createSubCollection, { isLoading: isCreating }] =
    useCreateSubCollectionMutation();
  const [updateSubCollection, { isLoading: isUpdating }] =
    useUpdateSubCollectionMutation();
  const [deleteSubCollection, { isLoading: isDeleting }] =
    useDeleteSubCollectionMutation();

  // Calculate total items for TableLayout
  const totalItems =
    subCollectionsData?.count ||
    subCollectionsData?.subCollections?.length ||
    0;

  // Displayed data - TableLayout handles pagination and search
  const displayedSubCollections = subCollectionsData?.subCollections || [];

  // Get collections list
  const collections = collectionsData?.collections || [];

  // Column definitions based on SubCollection model
  const columns = [
    { key: "subCollectionName", label: "Sub-collection" },
    { key: "collection", label: "Collection" },
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

  const handleCollectionChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      collection: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Invalid file type", {
          description: "Please select an image file.",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File too large", {
          description: "Please select an image smaller than 5MB.",
        });
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setFormData((prev) => ({
          ...prev,
          image: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setFormData((prev) => ({
      ...prev,
      image: null,
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!formData.subCollectionName.trim()) {
      toast.error("Sub-collection name is required", {
        description: "Please enter a sub-collection name.",
      });
      return;
    }

    if (!formData.collection) {
      toast.error("Collection is required", {
        description: "Please select a parent collection.",
      });
      return;
    }

    // Validate image for new sub-collections
    if (dialogMode === "add" && !formData.image) {
      toast.error("Sub-collection image is required", {
        description: "Please upload an image for the sub-collection.",
      });
      return;
    }

    try {
      const subCollectionData = {
        subCollectionName: formData.subCollectionName.trim(),
        description: formData.description.trim(),
        collection: formData.collection,
        ...(formData.image && { image: formData.image }),
      };

      if (dialogMode === "edit" && selectedSubCollection) {
        // Update existing sub-collection
        const subCollectionId =
          selectedSubCollection._id || selectedSubCollection.id;
        const response = await updateSubCollection({
          id: subCollectionId,
          ...subCollectionData,
        }).unwrap();

        if (response.success) {
          toast.success(
            response.message || "Sub-collection updated successfully",
            {
              description: `The sub-collection "${response.subCollection.subCollectionName}" has been updated.`,
            }
          );

          // Reset form and close dialog
          setFormData({
            subCollectionName: "",
            description: "",
            collection: "",
            image: null,
          });
          setImagePreview(null);
          setSelectedSubCollection(null);
          setDialogMode("add");
          setDialogOpen(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      } else {
        // Create new sub-collection
        const response = await createSubCollection(subCollectionData).unwrap();

        if (response.success) {
          toast.success(
            response.message || "Sub-collection created successfully",
            {
              description: `The sub-collection "${response.subCollection.subCollectionName}" has been created.`,
            }
          );

          // Reset form and close dialog
          setFormData({
            subCollectionName: "",
            description: "",
            collection: "",
            image: null,
          });
          setImagePreview(null);
          setDialogOpen(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      }
    } catch (error) {
      console.error(
        `${dialogMode === "edit" ? "Update" : "Create"} sub-collection error:`,
        error
      );
      toast.error(
        error?.data?.message ||
          `Failed to ${
            dialogMode === "edit" ? "update" : "create"
          } sub-collection`,
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
        subCollectionName: "",
        description: "",
        collection: "",
        image: null,
      });
      setImagePreview(null);
      setSelectedSubCollection(null);
      setDialogMode("add");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAdd = () => {
    setDialogMode("add");
    setSelectedSubCollection(null);
    setFormData({
      subCollectionName: "",
      description: "",
      collection: "",
      image: null,
    });
    setImagePreview(null);
    setDialogOpen(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleEdit = (subCollection) => {
    setDialogMode("edit");
    setSelectedSubCollection(subCollection);
    setFormData({
      subCollectionName: subCollection.subCollectionName || "",
      description: subCollection.description || "",
      collection:
        subCollection.collection?._id || subCollection.collection || "",
      image: null, // Don't preload existing image
    });

    // Set preview from existing image
    const imageUrl = subCollection.image?.url || null;
    setImagePreview(imageUrl);
    setDialogOpen(true);
  };

  const handleDelete = (subCollection) => {
    setSelectedSubCollection(subCollection);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedSubCollection) return;

    try {
      const subCollectionId =
        selectedSubCollection._id || selectedSubCollection.id;
      const response = await deleteSubCollection(subCollectionId).unwrap();

      toast.success(response.message || "Sub-collection deleted successfully", {
        description: `The sub-collection "${selectedSubCollection.subCollectionName}" has been removed.`,
      });

      setDeleteDialogOpen(false);
      setSelectedSubCollection(null);
    } catch (error) {
      console.error("Delete sub-collection error:", error);
      toast.error(error?.data?.message || "Failed to delete sub-collection", {
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
          <h1 className="text-3xl font-bold">Sub-collection Management</h1>
          <p className="text-sm text-popover-foreground/80 mt-2">
            Manage product sub-collections in your store
          </p>
        </div>
        <Button variant="accent" onClick={handleAdd}>
          <Plus className="size-4" />
          Add Sub-collection
        </Button>
      </div>

      <TableLayout
        searchPlaceholder="Search sub-collections..."
        totalItems={totalItems}
        columns={columns}
        data={displayedSubCollections}
        isLoading={isLoadingSubCollections}
        loadingMessage="Loading sub-collections..."
        emptyMessage="No sub-collection found..."
        searchFields={[
          "subCollectionName",
          "description",
          "collection.collectionName",
        ]}
        renderRow={(subCollection) => (
          <>
            <TableCell maxWidth="200px">
              {subCollection.subCollectionName}
            </TableCell>
            <TableCell maxWidth="200px">
              {subCollection.collection?.collectionName || "-"}
            </TableCell>
            <TableCell maxWidth="300px">
              {subCollection.description || "-"}
            </TableCell>
            <TableCell>
              {subCollection.createdAt
                ? new Date(subCollection.createdAt).toLocaleString()
                : "-"}
            </TableCell>
            <TableCell>
              {subCollection.updatedAt
                ? new Date(subCollection.updatedAt).toLocaleString()
                : "-"}
            </TableCell>
            <ActionsColumn
              onEdit={() => handleEdit(subCollection)}
              onDelete={() => handleDelete(subCollection)}
            />
          </>
        )}
      />

      {/* Add/Edit Sub-collection Dialog */}
      <AddUpdateItemDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        mode={dialogMode}
        title={
          dialogMode === "edit"
            ? "Edit Sub-collection"
            : "Add New Sub-collection"
        }
        description={
          dialogMode === "edit"
            ? "Update the sub-collection details."
            : "Create a new sub-collection for your products."
        }
        onSubmit={handleSubmit}
        isLoading={dialogMode === "edit" ? isUpdating : isCreating}
        submitButtonText={
          dialogMode === "edit"
            ? "Update Sub-collection"
            : "Create Sub-collection"
        }
      >
        <div className="space-y-2">
          <Label htmlFor="collection">Collection</Label>
          <Select
            value={formData.collection}
            onValueChange={handleCollectionChange}
            disabled={dialogMode === "edit" ? isUpdating : isCreating}
          >
            <SelectTrigger id="collection" className="w-full">
              <SelectValue placeholder="Select a collection" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingCollections ? (
                <SelectItem value="loading" disabled>
                  Loading collections...
                </SelectItem>
              ) : collections.length === 0 ? (
                <SelectItem value="empty" disabled>
                  No collections available
                </SelectItem>
              ) : (
                collections.map((collection) => (
                  <SelectItem
                    key={collection._id || collection.id}
                    value={collection._id || collection.id}
                  >
                    {collection.collectionName}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subCollectionName">Sub-collection Name</Label>
          <Input
            id="subCollectionName"
            name="subCollectionName"
            type="text"
            placeholder="e.g., The Mandalorian, Hogwarts Castle"
            value={formData.subCollectionName}
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
            placeholder="Enter sub-collection description (optional)"
            value={formData.description}
            onChange={handleChange}
            disabled={dialogMode === "edit" ? isUpdating : isCreating}
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="image">Sub-collection Image</Label>
          {imagePreview ? (
            <div className="relative w-full h-48 border rounded-lg overflow-hidden">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-full object-contain"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handleRemoveImage}
                disabled={dialogMode === "edit" ? isUpdating : isCreating}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <label
              htmlFor="image"
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors block"
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                {dialogMode === "edit"
                  ? "Upload a new image to replace the current one"
                  : "Click to upload an image"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, WEBP up to 5MB
              </p>
              <Input
                ref={fileInputRef}
                id="image"
                name="image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={dialogMode === "edit" ? isUpdating : isCreating}
                className="hidden"
              />
            </label>
          )}
        </div>
      </AddUpdateItemDialog>

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemName={selectedSubCollection?.subCollectionName || ""}
        title="Delete Sub-collection"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default SubCollectionManagement;
