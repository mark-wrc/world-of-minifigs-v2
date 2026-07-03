import { useEffect, useCallback, useState } from "react";
import { toast } from "sonner";
import { uploadImagesToCloudinary } from "@/utils/cloudinaryUpload";
import {
  useGetDealerTorsoBagsQuery,
  useCreateDealerTorsoBagMutation,
  useUpdateDealerTorsoBagMutation,
  useDeleteDealerTorsoBagMutation,
} from "@/redux/api/adminApi";
import { extractPaginatedData } from "@/utils/apiHelpers";
import { sanitizeString } from "@/utils/formatting";
import {
  validateDealerTorsoBag,
  validateTorsoAllocation,
  showTorsoAllocationWarning,
} from "@/utils/validation";
import useMediaPreview from "@/hooks/admin/useMediaPreview";
import useAdminCrud from "@/hooks/admin/useAdminCrud";

// Misc-per-bag for each base size. Same constants as backend/services/bundleService.js.
const MISC_PER_BAG = { 100: 10, 500: 40 };
const getAdminTarget = (base) => base - (MISC_PER_BAG[base] ?? 0);

const BASE_SIZE_OPTIONS = [
  { value: 100, label: "100" },
  { value: 500, label: "500" },
];

const initialFormData = {
  bagName: "",
  baseSize: 100,
  stock: 0,
  isActive: true,
  items: [],
};

const columns = [
  { key: "bagName", label: "Bag Name" },
  { key: "baseSize", label: "Base Size" },
  { key: "itemCount", label: "Total Designs" },
  { key: "stock", label: "Stock" },
  { key: "isActive", label: "Status" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" },
  { key: "actions", label: "Actions" },
];

const useDealerTorsoBagManagement = () => {
  // ------------------------------- Media ------------------------------------
  const {
    filePreview,
    setFilePreview,
    fileInputRef,
    resetFile,
    handleFileChange: onFileChange,
    handleRemoveFile: onFileRemove,
  } = useMediaPreview({ multiple: true });

  // ------------------------------- Mutations ------------------------------------
  const [createBag, { isLoading: isCreating }] =
    useCreateDealerTorsoBagMutation();
  const [updateBag, { isLoading: isUpdating }] =
    useUpdateDealerTorsoBagMutation();
  const [deleteBag, { isLoading: isDeleting }] =
    useDeleteDealerTorsoBagMutation();

  // ------------------------------- Core CRUD ------------------------------------
  const crud = useAdminCrud({
    initialFormData,
    createFn: createBag,
    updateFn: updateBag,
    deleteFn: deleteBag,
    entityName: "torso bag",
    onReset: resetFile,
  });

  // ------------------------------- Fetch ------------------------------------
  const { data: torsoBagData, isLoading: isLoadingBags } =
    useGetDealerTorsoBagsQuery({
      page: crud.page,
      limit: crud.limit,
      search: crud.search || undefined,
    });

  const {
    items: bags,
    totalItems,
    totalPages,
  } = extractPaginatedData(torsoBagData, "bags");

  useEffect(() => {
    crud.setTotalItems(totalItems);
  }, [totalItems]);

  // Tracks the direct browser→Cloudinary upload happening before the save call.
  const [uploadProgress, setUploadProgress] = useState({
    isUploading: false,
    done: 0,
    total: 0,
  });

  const isSubmitting =
    uploadProgress.isUploading || (crud.isEditMode ? isUpdating : isCreating);

  const baseSize = Number(crud.formData.baseSize) || 100;
  const miscQuantity = MISC_PER_BAG[baseSize] ?? 0;
  const adminTarget = getAdminTarget(baseSize);

  const currentTotal = crud.formData.items.reduce(
    (acc, item) => acc + (Number(item.quantity) || 1),
    0,
  );

  // ------------------------------- Edit Handler ------------------------------------
  const handleEdit = (bag) => {
    const existingItems =
      bag.items?.map((item) => ({
        url: item.image?.url || "",
        quantity: item.quantity || 1,
        image: item.image || null,
      })) || [];

    setFilePreview(existingItems);

    crud.openEdit(bag, {
      bagName: bag.bagName || "",
      baseSize: bag.baseSize || 100,
      stock: bag.stock ?? 0,
      isActive: bag.isActive !== false,
      items: existingItems,
    });
  };

  // ------------------------------- Media Handlers ------------------------------------
  const handleDealerTorsoBagFileChange = useCallback(
    async (e) => {
      let skippedCount = 0;

      const items = await onFileChange(e, {
        mapFile: (url, file) => {
          if (currentTotal + 1 > adminTarget) {
            skippedCount++;
            return null;
          }
          return {
            url,
            quantity: 1,
            // `url` is a local data-URL used only for the preview thumbnail.
            // `file` is the raw File we upload directly to Cloudinary at submit.
            // No `publicId` yet marks this as a not-yet-uploaded item.
            image: { url },
            file,
          };
        },
      });

      const validItems = (items || []).filter(Boolean);

      if (skippedCount > 0) {
        showTorsoAllocationWarning(
          skippedCount,
          adminTarget,
          baseSize,
          miscQuantity,
        );
      }

      if (validItems.length > 0) {
        crud.setFormData((prev) => ({
          ...prev,
          items: [...prev.items, ...validItems],
        }));
      }
    },
    [onFileChange, currentTotal, adminTarget, baseSize, miscQuantity],
  );

  const handleDealerTorsoBagFileRemove = useCallback(
    (index) => {
      onFileRemove(index);
      crud.setFormData((prev) => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      }));
    },
    [onFileRemove],
  );

  // ------------------------------- Submit Handler ------------------------------------
  const handleSubmit = async () => {
    if (
      !validateDealerTorsoBag(
        crud.formData,
        adminTarget,
        baseSize,
        miscQuantity,
      )
    )
      return;

    const formItems = crud.formData.items;

    // Freshly-picked items still carry a raw File and no Cloudinary publicId.
    // Upload those directly to Cloudinary; existing items are already stored.
    const pendingUploads = formItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item?.file && !item?.image?.publicId);

    let uploadedRefs = [];
    if (pendingUploads.length > 0) {
      setUploadProgress({
        isUploading: true,
        done: 0,
        total: pendingUploads.length,
      });
      try {
        uploadedRefs = await uploadImagesToCloudinary(
          pendingUploads.map(({ item }) => item.file),
          "torso",
          {
            onProgress: (done, total) =>
              setUploadProgress({ isUploading: true, done, total }),
          },
        );
      } catch (error) {
        setUploadProgress({ isUploading: false, done: 0, total: 0 });
        toast.error("Image upload failed", {
          description:
            error?.message || "Could not upload torso images. Please try again.",
        });
        return;
      }
      setUploadProgress({ isUploading: false, done: 0, total: 0 });
    }

    // Map each uploaded { publicId, url } back to its original item by index.
    const refByIndex = new Map();
    pendingUploads.forEach(({ index }, i) => {
      refByIndex.set(index, uploadedRefs[i]);
    });

    // Only compact { publicId, url } references leave the browser now — no
    // base64 image bytes — so the request body stays a few KB regardless of
    // how many designs the bag contains.
    const items = formItems.map((item, index) => ({
      image: refByIndex.get(index) || {
        publicId: item?.image?.publicId,
        url: item?.image?.url,
      },
      quantity:
        item.quantity === "" || item.quantity == null
          ? 1
          : Number(item.quantity),
    }));

    const payload = {
      bagName: sanitizeString(crud.formData.bagName),
      baseSize,
      stock: Math.max(0, Number(crud.formData.stock) || 0),
      isActive: crud.formData.isActive,
      items,
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

  const handleUpdateItemQuantity = (index) => (e) => {
    const value = e?.target ? e.target.value : e;
    const strValue = value.toString();

    // Allow empty string to let users clear the input
    if (strValue === "") {
      crud.setFormData((prev) => {
        const newItems = [...prev.items];
        newItems[index] = { ...newItems[index], quantity: "" };
        return { ...prev, items: newItems };
      });
      return;
    }

    const cleaned = strValue.replace(/[^0-9]/g, "");
    if (!cleaned) return;

    const newValue = parseInt(cleaned, 10);
    if (newValue < 1) return;

    const otherItemsTotal = crud.formData.items.reduce(
      (acc, item, i) =>
        i === index ? acc : acc + (Number(item.quantity) || 0),
      0,
    );

    if (!validateTorsoAllocation(otherItemsTotal, newValue, adminTarget))
      return;

    crud.setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], quantity: newValue };
      return { ...prev, items: newItems };
    });
  };

  // ------------------------------- Return ------------------------------------
  return {
    ...crud,
    filePreview,
    bags,
    totalItems,
    totalPages,
    columns,
    baseSizeOptions: BASE_SIZE_OPTIONS,
    adminTarget,
    miscQuantity,
    currentTotal,
    isLoadingBags,
    isSubmitting,
    uploadProgress,
    isDeleting,
    handleEdit,
    handleDealerTorsoBagFileChange,
    handleDealerTorsoBagFileRemove,
    handleUpdateItemQuantity,
    handleSubmit,
    handleChange,
    handleValueChange,
  };
};

export default useDealerTorsoBagManagement;
