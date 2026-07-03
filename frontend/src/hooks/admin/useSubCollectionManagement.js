import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  useGetSubCollectionsQuery,
  useCreateSubCollectionMutation,
  useUpdateSubCollectionMutation,
  useDeleteSubCollectionMutation,
  useGetCollectionsQuery,
} from "@/redux/api/adminApi";
import { extractPaginatedData } from "@/utils/apiHelpers";
import { sanitizeString, sortByName } from "@/utils/formatting";
import { validateSubCollection } from "@/utils/validation";
import { uploadImageToCloudinary } from "@/utils/cloudinaryUpload";
import useMediaPreview from "@/hooks/admin/useMediaPreview";
import useAdminCrud from "@/hooks/admin/useAdminCrud";

const initialFormData = {
  subCollectionName: "",
  description: "",
  collection: "",
  isActive: true,
  image: null,
};

const columns = [
  { key: "subCollectionName", label: "Sub-collection" },
  { key: "collection", label: "Collection" },
  { key: "description", label: "Description" },
  { key: "isActive", label: "Status" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" },
  { key: "actions", label: "Actions" },
];

const useSubCollectionManagement = () => {
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

  const resetSubCollectionImage = useCallback(() => {
    setImageFile(null);
    resetFile();
  }, [resetFile]);

  // ------------------------------- Mutations ------------------------------------
  const [createSubCollection, { isLoading: isCreating }] =
    useCreateSubCollectionMutation();
  const [updateSubCollection, { isLoading: isUpdating }] =
    useUpdateSubCollectionMutation();
  const [deleteSubCollection, { isLoading: isDeleting }] =
    useDeleteSubCollectionMutation();

  // ------------------------------- Core CRUD ------------------------------------
  const crud = useAdminCrud({
    initialFormData,
    createFn: createSubCollection,
    updateFn: updateSubCollection,
    deleteFn: deleteSubCollection,
    entityName: "sub-collection",
    onReset: resetSubCollectionImage,
  });

  // ------------------------------- Fetch ------------------------------------
  const { data: subCollectionsData, isLoading: isLoadingSubCollections } =
    useGetSubCollectionsQuery({
      page: crud.page,
      limit: crud.limit,
      search: crud.search || undefined,
    });

  const { data: collectionsData, isLoading: isLoadingCollections } =
    useGetCollectionsQuery();

  const {
    items: subCollections,
    totalItems,
    totalPages,
  } = extractPaginatedData(subCollectionsData, "subCollections");

  const collections = useMemo(
    () => sortByName(collectionsData?.collections, "collectionName"),
    [collectionsData],
  );

  useEffect(() => {
    crud.setTotalItems(totalItems);
  }, [totalItems]);

  const isSubmitting =
    uploadProgress.isUploading || (crud.isEditMode ? isUpdating : isCreating);

  // ------------------------------- File Handlers ------------------------------------
  const handleSubCollectionFileChange = async (e) => {
    // Keep the raw File for direct upload; data-URL is the preview + "new" signal.
    const dataUrl = await handleFileChange(e, {
      mapFile: (url, file) => {
        setImageFile(file);
        return url;
      },
    });
    if (dataUrl) {
      crud.setFormData((prev) => ({ ...prev, image: dataUrl }));
    }
  };

  const handleSubCollectionFileRemove = () => {
    handleRemoveFile();
    setImageFile(null);
    crud.setFormData((prev) => ({ ...prev, image: null }));
  };

  // ------------------------------- Edit Handler ------------------------------------
  const handleEdit = (subCollection) => {
    crud.openEdit(subCollection, {
      subCollectionName: subCollection.subCollectionName || "",
      description: subCollection.description || "",
      isActive: subCollection.isActive !== false,
      image: null,
      collection: subCollection.collectionId?._id || "",
    });

    setFilePreview(subCollection.image?.url || null);
  };

  // ------------------------------- Submit Handler ------------------------------------
  const handleSubmit = async () => {
    if (!validateSubCollection(crud.formData, crud.dialogMode)) return;

    // Upload a newly-picked image directly to Cloudinary first.
    let imageRef;
    if (crud.formData.image && imageFile) {
      setUploadProgress({ isUploading: true, done: 0, total: 1 });
      try {
        imageRef = await uploadImageToCloudinary(imageFile, "sub-collection");
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
      subCollectionName: sanitizeString(crud.formData.subCollectionName),
      description: sanitizeString(crud.formData.description),
      isActive: crud.formData.isActive,
      ...(imageRef && { image: imageRef }),
      collection: crud.formData.collection,
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
    subCollections,
    totalItems,
    totalPages,
    collections,
    columns,
    isLoadingSubCollections,
    isLoadingCollections,
    isSubmitting,
    uploadProgress,
    isDeleting,
    handleSubCollectionFileChange,
    handleSubCollectionFileRemove,
    handleEdit,
    handleSubmit,
    handleChange,
    handleValueChange,
  };
};

export default useSubCollectionManagement;
