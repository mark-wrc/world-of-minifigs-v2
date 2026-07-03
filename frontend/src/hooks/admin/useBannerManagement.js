import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  useGetBannersQuery,
  useCreateBannerMutation,
  useUpdateBannerMutation,
  useDeleteBannerMutation,
} from "@/redux/api/adminApi";
import { extractPaginatedData } from "@/utils/apiHelpers";
import { sanitizeString, sanitizeOptional } from "@/utils/formatting";
import { validateBanner } from "@/utils/validation";
import { uploadMediaToCloudinary } from "@/utils/cloudinaryUpload";
import useMediaPreview from "@/hooks/admin/useMediaPreview";
import useAdminCrud from "@/hooks/admin/useAdminCrud";

const initialFormData = {
  badge: "",
  label: "",
  description: "",
  position: "center",
  textTheme: "light",
  media: null,
  mediaType: "image",
  enableButtons: false,
  buttons: [
    { label: "", href: "", variant: "default" },
    { label: "", href: "", variant: "default" },
  ],
  isActive: true,
  order: 1,
};

const columns = [
  { key: "badge", label: "Badge" },
  { key: "label", label: "Label" },
  { key: "order", label: "Order" },
  { key: "position", label: "Position" },
  { key: "isActive", label: "Status" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" },
  { key: "actions", label: "Actions" },
];

const useBannerManagement = () => {
  // ---------------------------- Media ----------------------------
  const {
    filePreview,
    setFilePreview,
    fileInputRef,
    resetFile,
    handleFileChange,
    handleRemoveFile,
  } = useMediaPreview({ allowVideo: true, maxSizeMB: 10 });

  // Raw File for a newly-picked banner media, uploaded to Cloudinary at submit.
  const [bannerMediaFile, setBannerMediaFile] = useState(null);

  // Tracks the direct browser→Cloudinary upload happening before the save call.
  const [uploadProgress, setUploadProgress] = useState({
    isUploading: false,
    done: 0,
    total: 0,
  });

  const resetBannerMedia = useCallback(() => {
    setBannerMediaFile(null);
    resetFile();
  }, [resetFile]);

  // ---------------------------- Mutations ----------------------------
  const [createBanner, { isLoading: isCreating }] = useCreateBannerMutation();
  const [updateBanner, { isLoading: isUpdating }] = useUpdateBannerMutation();
  const [deleteBanner, { isLoading: isDeleting }] = useDeleteBannerMutation();

  // ---------------------------- Core CRUD ----------------------------
  const crud = useAdminCrud({
    initialFormData,
    createFn: createBanner,
    updateFn: updateBanner,
    deleteFn: deleteBanner,
    entityName: "banner",
    onReset: resetBannerMedia,
  });

  // ---------------------------- Fetch ----------------------------
  const { data: bannersData, isLoading: isLoadingBanners } = useGetBannersQuery(
    {
      page: crud.page,
      limit: crud.limit,
      search: crud.search || undefined,
    },
  );

  const {
    items: banners,
    totalItems,
    totalPages,
  } = extractPaginatedData(bannersData, "banners");

  useEffect(() => {
    crud.setTotalItems(totalItems);
  }, [totalItems]);

  const isSubmitting =
    uploadProgress.isUploading || (crud.isEditMode ? isUpdating : isCreating);

  // ---------------------------- Media Handlers ----------------------------
  const handleBannerFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const mediaType = file.type.startsWith("video") ? "video" : "image";
    // Keep the raw File for direct upload; the data-URL is preview-only and
    // still acts as the "new media" signal on formData.media.
    const dataUrl = await handleFileChange(e, {
      mapFile: (url, picked) => {
        setBannerMediaFile(picked);
        return url;
      },
    });

    if (dataUrl) {
      crud.setFormData((prev) => ({
        ...prev,
        media: dataUrl,
        mediaType,
      }));
    }
  };

  const handleBannerFileRemove = () => {
    handleRemoveFile();
    setBannerMediaFile(null);
    crud.setFormData((prev) => ({
      ...prev,
      media: null,
    }));
  };

  // ---------------------------- Add Handler ----------------------------
  const handleAdd = () => {
    const maxOrder =
      banners.length > 0 ? Math.max(...banners.map((b) => b.order || 0)) : 0;

    crud.handleAdd({ order: maxOrder + 1 });
  };

  // ---------------------------- Edit Handler ----------------------------
  const handleEdit = (banner) => {
    crud.openEdit(banner, {
      badge: banner.badge || "",
      label: banner.label || "",
      description: banner.description || "",
      position: banner.position || "center",
      textTheme: banner.textTheme || "light",
      media: null,
      mediaType: banner.media?.resourceType || "image",
      enableButtons: banner.enableButtons || false,
      buttons:
        banner.buttons?.length > 0
          ? banner.buttons.slice(0, 2).map((btn) => ({
              label: btn.label || "",
              href: btn.href || "",
              variant: btn.variant || "default",
            }))
          : [
              { label: "", href: "", variant: "default" },
              { label: "", href: "", variant: "default" },
            ],
      isActive: banner.isActive !== false,
      order: banner.order || 1,
    });

    setFilePreview(banner.media?.url || null);
  };

  // ---------------------------- Submit Handler ----------------------------
  const handleSubmit = async () => {
    if (!validateBanner(crud.formData, crud.dialogMode)) return;

    // Upload newly-picked media directly to Cloudinary first (image or video).
    let mediaRef;
    if (crud.formData.media && bannerMediaFile) {
      setUploadProgress({ isUploading: true, done: 0, total: 1 });
      try {
        mediaRef = await uploadMediaToCloudinary(bannerMediaFile, "banner");
      } catch (error) {
        setUploadProgress({ isUploading: false, done: 0, total: 0 });
        toast.error("Media upload failed", {
          description: error?.message || "Could not upload banner media.",
        });
        return;
      }
      setUploadProgress({ isUploading: false, done: 0, total: 0 });
    }

    const buttons = crud.formData.enableButtons
      ? crud.formData.buttons
          .filter((b) => sanitizeString(b.label) && sanitizeString(b.href))
          .map((b) => ({
            label: sanitizeString(b.label),
            href: sanitizeString(b.href),
            variant: b.variant || "default",
          }))
          .slice(0, 2)
      : null;

    const payload = {
      badge: sanitizeOptional(crud.formData.badge),
      label: sanitizeString(crud.formData.label),
      description: sanitizeString(crud.formData.description),
      position: crud.formData.position,
      textTheme: crud.formData.textTheme,
      enableButtons: crud.formData.enableButtons,
      isActive: crud.formData.isActive,
      order: crud.formData.order,
      ...(buttons?.length && { buttons }),
      // Send the uploaded media reference (never the raw bytes).
      ...(mediaRef && { media: mediaRef }),
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
    crud.setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNestedChange = (arrayName, index, field) => (e) => {
    const value = e?.target
      ? e.target.type === "checkbox"
        ? e.target.checked
        : e.target.value
      : e;

    crud.setFormData((prev) => {
      const newArray = [...(prev[arrayName] || [])];
      newArray[index] = {
        ...newArray[index],
        [field]: value,
      };
      return { ...prev, [arrayName]: newArray };
    });
  };

  // ---------------------------- Return ----------------------------
  return {
    ...crud,
    filePreview,
    fileInputRef,
    banners,
    totalItems,
    totalPages,
    columns,
    isLoadingBanners,
    isSubmitting,
    uploadProgress,
    isDeleting,
    handleBannerFileChange,
    handleBannerFileRemove,
    handleSubmit,
    handleAdd,
    handleEdit,
    handleChange,
    handleValueChange,
    handleNestedChange,
  };
};

export default useBannerManagement;
