import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useGetCollectionsQuery,
  useDeleteCollectionMutation,
} from "@/redux/api/adminApi";
import { extractPaginatedData } from "@/utils/apiHelpers";
import { sanitizeString } from "@/utils/formatting";
import { validateCollection } from "@/utils/validation";
import { uploadImageToCloudinary } from "@/utils/cloudinaryUpload";
import useMediaPreview from "@/hooks/admin/useMediaPreview";
import useAdminCrud from "@/hooks/admin/useAdminCrud";

const initialFormData = {
  collectionName: "",
  description: "",
  isFeatured: false,
  isActive: true,
  image: null,
};

const columns = [
  { key: "collectionName", label: "Collection" },
  { key: "description", label: "Description" },
  { key: "isFeatured", label: "Featured" },
  { key: "isActive", label: "Status" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" },
  { key: "actions", label: "Actions" },
];

const useCollectionManagement = () => {
  // ------------------------------- Media ------------------------------------
  const {
    filePreview,
    setFilePreview,
    fileInputRef,
    resetFile,
    handleFileChange,
    handleRemoveFile,
  } = useMediaPreview();

  // Raw File for a newly-picked image, uploaded to Cloudinary at submit.
  const [imageFile, setImageFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({
    isUploading: false,
    done: 0,
    total: 0,
  });

  const resetCollectionImage = useCallback(() => {
    setImageFile(null);
    resetFile();
  }, [resetFile]);

  // ------------------------------- Mutations ------------------------------------
  const [createCollection, { isLoading: isCreating }] =
    useCreateCollectionMutation();
  const [updateCollection, { isLoading: isUpdating }] =
    useUpdateCollectionMutation();
  const [deleteCollection, { isLoading: isDeleting }] =
    useDeleteCollectionMutation();

  // ------------------------------- Core CRUD ------------------------------------
  const crud = useAdminCrud({
    initialFormData,
    createFn: createCollection,
    updateFn: updateCollection,
    deleteFn: deleteCollection,
    entityName: "collection",
    onReset: resetCollectionImage,
  });

  // ------------------------------- Fetch ------------------------------------
  const { data: collectionsData, isLoading: isLoadingCollections } =
    useGetCollectionsQuery({
      page: crud.page,
      limit: crud.limit,
      search: crud.search || undefined,
    });

  const {
    items: collections,
    totalItems,
    totalPages,
  } = extractPaginatedData(collectionsData, "collections");

  useEffect(() => {
    crud.setTotalItems(totalItems);
  }, [totalItems]);

  const isSubmitting =
    uploadProgress.isUploading || (crud.isEditMode ? isUpdating : isCreating);

  // ------------------------------- Media Handlers ------------------------------------
  const handleCollectionFileChange = async (e) => {
    // Keep the raw File for direct upload; data-URL is the preview + "new" signal.
    const dataUrl = await handleFileChange(e, {
      mapFile: (url, file) => {
        setImageFile(file);
        return url;
      },
    });
    if (dataUrl) {
      crud.setFormData((prev) => ({
        ...prev,
        image: dataUrl,
      }));
    }
  };

  const handleCollectionFileRemove = () => {
    handleRemoveFile();
    setImageFile(null);
    crud.setFormData((prev) => ({
      ...prev,
      image: null,
    }));
  };

  // ------------------------------- Edit Handler ------------------------------------
  const handleEdit = (collection) => {
    crud.openEdit(collection, {
      collectionName: collection.collectionName || "",
      description: collection.description || "",
      isFeatured: collection.isFeatured || false,
      isActive: collection.isActive !== false,
      image: null,
    });

    setFilePreview(collection.image?.url || null);
  };

  // ------------------------------- Submit Handler ------------------------------------
  const handleSubmit = async () => {
    if (!validateCollection(crud.formData)) return;

    // Upload a newly-picked image directly to Cloudinary first.
    let imageRef;
    if (crud.formData.image && imageFile) {
      setUploadProgress({ isUploading: true, done: 0, total: 1 });
      try {
        imageRef = await uploadImageToCloudinary(imageFile, "collection");
      } catch (error) {
        setUploadProgress({ isUploading: false, done: 0, total: 0 });
        toast.error("Image upload failed", {
          description: error?.message || "Could not upload image.",
        });
        return;
      }
      setUploadProgress({ isUploading: false, done: 0, total: 0 });
    }

    const payload = {
      collectionName: sanitizeString(crud.formData.collectionName),
      description: sanitizeString(crud.formData.description),
      isFeatured: crud.formData.isFeatured,
      isActive: crud.formData.isActive,
      ...(imageRef && { image: imageRef }),
    };

    await crud.submitForm(payload);
  };

  // ------------------------------- Handlers ------------------------------------
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    crud.setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleValueChange = (field) => (value) => {
    crud.setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ------------------------------- Return ------------------------------------
  return {
    ...crud,
    filePreview,
    fileInputRef,
    collections,
    totalItems,
    totalPages,
    columns,
    isLoadingCollections,
    isSubmitting,
    uploadProgress,
    isDeleting,
    handleCollectionFileChange,
    handleCollectionFileRemove,
    handleEdit,
    handleSubmit,
    handleChange,
    handleValueChange,
  };
};

export default useCollectionManagement;
