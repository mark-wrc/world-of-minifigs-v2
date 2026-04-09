import React, { useCallback, useEffect, useMemo } from "react";
import {
  useGetGeneralInventoryQuery,
  useCreateGeneralInventoryBulkMutation,
  useUpdateGeneralInventoryMutation,
  useDeleteGeneralInventoryMutation,
  useGetColorsQuery,
} from "@/redux/api/adminApi";
import { extractPaginatedData } from "@/utils/apiHelpers";
import { sanitizeString, sortByName } from "@/utils/formatting";
import { validateGeneralInventory } from "@/utils/validation";
import { validateFile, readFileAsDataURL } from "@/utils/fileHelpers";
import useMediaPreview from "@/hooks/admin/useMediaPreview";
import useAdminCrud from "@/hooks/admin/useAdminCrud";

const initialFormData = {
  isActive: true,
};

const columns = [
  { key: "minifigName", label: "Minifig Name" },
  { key: "color", label: "Color" },
  { key: "price", label: "Price" },
  { key: "stock", label: "Stock" },
  { key: "isActive", label: "Status" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" },
  { key: "actions", label: "Actions" },
];

// Factory for preview item
const makeNewPreview = (url) => ({
  url,
  minifigName: "",
  price: "",
  stock: "",
  color: "",
  image: { url },
});

const useGeneralInventoryManagement = () => {
  // ------------------------------- Media ------------------------------------
  const {
    filePreview,
    setFilePreview,
    fileInputRef,
    resetFile,
    handleFileChange,
    handleRemoveFile,
  } = useMediaPreview({ multiple: true });

  // ------------------------------- Mutations ------------------------------------
  const [createBulk, { isLoading: isCreating }] =
    useCreateGeneralInventoryBulkMutation();
  const [updateItem, { isLoading: isUpdating }] =
    useUpdateGeneralInventoryMutation();
  const [deleteItem, { isLoading: isDeleting }] =
    useDeleteGeneralInventoryMutation();

  // ------------------------------- Core CRUD ------------------------------------
  const crud = useAdminCrud({
    initialFormData,
    createFn: createBulk,
    updateFn: updateItem,
    deleteFn: deleteItem,
    entityName: "general-inventory",
    onReset: resetFile,
  });

  // ------------------------------- Fetch ------------------------------------
  const { data: inventoryData, isLoading: isLoadingInventory } =
    useGetGeneralInventoryQuery({
      page: crud.page,
      limit: crud.limit,
      search: crud.search || undefined,
    });

  const { data: colorsData, isLoading: isLoadingColors } = useGetColorsQuery();

  const {
    items: inventory,
    totalItems,
    totalPages,
  } = extractPaginatedData(inventoryData, "inventory");

  const colors = useMemo(
    () => sortByName(colorsData?.colors, "colorName"),
    [colorsData],
  );

  useEffect(() => {
    crud.setTotalItems(totalItems);
  }, [totalItems]);

  const isSubmitting = crud.dialogMode === "edit" ? isUpdating : isCreating;

  // ------------------------------- File Handlers ------------------------------------
  const handleInventoryFileChange = async (e) => {
    if (crud.dialogMode === "edit") {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        const file = files[0];
        if (!validateFile(file)) return;
        const dataUrl = await readFileAsDataURL(file);
        setFilePreview((prev) =>
          prev.map((item, i) => (i === 0 ? { ...item, url: dataUrl } : item)),
        );
      }
    } else {
      await handleFileChange(e, { mapFile: makeNewPreview });
    }
  };

  // Stable ref-cached handler factories — return the SAME function for the same index so that React.memo children skip re-rendering on sibling edits.
  const itemChangeHandlers = React.useRef({});
  const valueChangeHandlers = React.useRef({});

  const clearHandlerCaches = useCallback(() => {
    itemChangeHandlers.current = {};
    valueChangeHandlers.current = {};
  }, []);

  const handleInventoryFileRemove = useCallback(
    (index) => {
      if (crud.dialogMode === "edit") {
        // In edit mode, only clear the image URL — preserve metadata fields
        setFilePreview((prev) =>
          prev.map((item, i) =>
            i === (typeof index === "number" ? index : 0)
              ? { ...item, url: null, image: null }
              : item,
          ),
        );
      } else {
        const targetIndex = typeof index === "number" ? index : 0;
        handleRemoveFile(targetIndex);
        clearHandlerCaches();
      }
    },
    [crud.dialogMode, handleRemoveFile, setFilePreview, clearHandlerCaches],
  );

  const getItemChangeHandler = useCallback(
    (index) => {
      if (!itemChangeHandlers.current[index]) {
        itemChangeHandlers.current[index] = (e) => {
          const { name, value, type, checked } = e.target;
          const val = type === "checkbox" ? checked : value;
          setFilePreview((prev) =>
            prev.map((item, i) =>
              i === index ? { ...item, [name]: val } : item,
            ),
          );
        };
      }
      return itemChangeHandlers.current[index];
    },
    [setFilePreview],
  );

  const getValueChangeHandler = useCallback(
    (field, index) => {
      const key = `${field}_${index}`;
      if (!valueChangeHandlers.current[key]) {
        valueChangeHandlers.current[key] = (value) => {
          if (typeof index === "number") {
            setFilePreview((prev) =>
              prev.map((item, i) =>
                i === index ? { ...item, [field]: value } : item,
              ),
            );
          } else {
            crud.setFormData((prev) => ({ ...prev, [field]: value }));
          }
        };
      }
      return valueChangeHandlers.current[key];
    },
    [setFilePreview, crud.setFormData],
  );

  // ------------------------------- Edit Handler ------------------------------------
  const handleEdit = (item) => {
    setFilePreview([
      {
        url: item.image?.url,
        minifigName: item.minifigName,
        price: item.price,
        stock: item.stock,
        color: item.colorId?._id || item.colorId,
        image: item.image,
      },
    ]);

    crud.openEdit(item, {
      isActive: item.isActive !== false,
    });
  };

  // ------------------------------- Submit Handler ------------------------------------
  const handleSubmit = async () => {
    if (crud.dialogMode === "add") {
      if (!validateGeneralInventory(filePreview, crud.dialogMode === "add"))
        return;

      const payload = {
        items: filePreview.map((item) => ({
          minifigName: sanitizeString(item.minifigName),
          price: Number(item.price),
          stock: Number(item.stock),
          colorId: item.color,
          image:
            typeof item.url === "string" && item.url.startsWith("data:")
              ? item.url
              : item.image,
        })),
      };

      await crud.submitForm(payload);
    } else {
      if (!validateGeneralInventory(filePreview, crud.dialogMode === "add"))
        return;

      const item = filePreview[0];

      const payload = {
        minifigName: sanitizeString(item.minifigName),
        price: Number(item.price),
        stock: Number(item.stock),
        colorId: item.color,
        isActive: crud.formData.isActive,
        ...(typeof item.url === "string" &&
          item.url.startsWith("data:") && { image: item.url }),
      };

      await crud.submitForm(payload);
    }
  };

  // ------------------------------- Handlers ------------------------------------
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    crud.setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleValueChange = useCallback(
    (field, index) => {
      // For non-indexed calls (e.g. VisibilitySwitch), return a new handler
      if (typeof index !== "number") {
        return (value) =>
          crud.setFormData((prev) => ({ ...prev, [field]: value }));
      }
      // For indexed calls, delegate to the cached version
      return getValueChangeHandler(field, index);
    },
    [crud.setFormData, getValueChangeHandler],
  );

  // ------------------------------- Return ------------------------------------
  return {
    ...crud,
    filePreview,
    fileInputRef,
    inventory,
    totalItems,
    totalPages,
    columns,
    colors,
    isLoadingInventory,
    isLoadingColors,
    isSubmitting,
    isDeleting,
    handleInventoryFileChange,
    handleInventoryFileRemove,
    getItemChangeHandler,
    handleEdit,
    handleSubmit,
    handleChange,
    handleValueChange,
  };
};

export default useGeneralInventoryManagement;
