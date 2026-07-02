import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  useGetGeneralInventoryQuery,
  useCreateGeneralInventoryBulkMutation,
  useUpdateGeneralInventoryMutation,
  useDeleteGeneralInventoryMutation,
  useGetColorsQuery,
  useGetCollectionsQuery,
} from "@/redux/api/adminApi";
import { extractPaginatedData } from "@/utils/apiHelpers";
import { sanitizeString, sortByName } from "@/utils/formatting";
import { validateGeneralInventory } from "@/utils/validation";
import { validateFile, readFileAsDataURL } from "@/utils/fileHelpers";
import useMediaPreview from "@/hooks/admin/useMediaPreview";
import useAdminCrud from "@/hooks/admin/useAdminCrud";
import { INVENTORY_CATEGORY_OPTIONS } from "@shared/inventoryData";
import { toast } from "sonner";

export const INVENTORY_TABS = INVENTORY_CATEGORY_OPTIONS;

const initialFormData = {
  isActive: true,
};

const BASE_COLUMNS = [
  { key: "image", label: "Image" },
  { key: "minifigName", label: "Name" },
  { key: "itemId", label: "Item ID" },
  { key: "color", label: "Color" },
  { key: "cost", label: "Cost" },
  { key: "bin", label: "Bin" },
];
const PRICING_COLUMNS = [
  { key: "pricePerBag", label: "Bag Price" },
  { key: "piecesPerBag", label: "Qty/bag" },
  { key: "stock", label: "Stocks/bag" },
  { key: "soldBags", label: "Sales" },
];
const TAIL_COLUMNS = [
  { key: "isActive", label: "Status" },
  { key: "updatedAt", label: "Updated At" },
  { key: "actions", label: "Actions" },
];

// Factory for preview item
const makeNewPreview = (
  url,
  { category = "", collectionId = "", partType = "" } = {},
) => ({
  url,
  minifigName: "",
  itemId: "",
  pricePerBag: "",
  piecesPerBag: "",
  stock: "",
  color: "",
  category,
  collectionId,
  partType,
  image: { url },
});

const useGeneralInventoryManagement = () => {
  // ------------------------------- Tab State ------------------------------------
  const [activeTab, setActiveTab] = useState("accessories");

  // ------------------------------- Filter State ----------------------------------
  const [stockFilter, setStockFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("");
  const [partTypeFilter, setPartTypeFilter] = useState("");
  const [salesSort, setSalesSort] = useState("");

  const handleStockFilterChange = useCallback((value) => {
    setStockFilter(value === "all" ? "" : value);
  }, []);

  const handleStatusFilterChange = useCallback((value) => {
    setStatusFilter(value === "all" ? "" : value);
  }, []);

  const handleCollectionFilterChange = useCallback((value) => {
    setCollectionFilter(value === "all" ? "" : value);
  }, []);

  const handlePartTypeFilterChange = useCallback((value) => {
    setPartTypeFilter(value === "all" ? "" : value);
  }, []);

  const handleSalesSortChange = useCallback((value) => {
    setSalesSort(value === "none" ? "" : value);
  }, []);

  // Switch tab and clear filters that only apply to other tabs
  const handleTabChange = useCallback((value) => {
    setActiveTab(value);
    if (value !== "minifigs") setCollectionFilter("");
    if (value !== "bulk-minifig-parts") setPartTypeFilter("");
  }, []);

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
  const { data: inventoryData, isLoading, isFetching: isFetchingInventory } =
    useGetGeneralInventoryQuery({
      page: crud.page,
      limit: crud.limit,
      search: crud.search || undefined,
      category: activeTab,
      stock: stockFilter || undefined,
      status: statusFilter || undefined,
      collectionId:
        activeTab === "minifigs" ? collectionFilter || undefined : undefined,
      partType:
        activeTab === "bulk-minifig-parts"
          ? partTypeFilter || undefined
          : undefined,
      sort: salesSort || undefined,
    });

  const isLoadingInventory = isLoading || isFetchingInventory;

  const { data: colorsData, isLoading: isLoadingColors } = useGetColorsQuery();

  const { data: collectionsData, isLoading: isLoadingCollections } =
    useGetCollectionsQuery({ limit: "all" });

  const {
    items: inventory,
    totalItems,
    totalPages,
  } = extractPaginatedData(inventoryData, "inventory");

  const colors = useMemo(
    () => sortByName(colorsData?.colors, "colorName"),
    [colorsData],
  );

  const collections = useMemo(
    () => sortByName(collectionsData?.collections, "collectionName"),
    [collectionsData],
  );

  const columns = useMemo(() => {
    return [...BASE_COLUMNS, ...PRICING_COLUMNS, ...TAIL_COLUMNS];
  }, []);

  useEffect(() => {
    crud.setTotalItems(totalItems);
  }, [totalItems]);

  // Reset to page 1 when the active tab or any filter changes
  useEffect(() => {
    crud.handlePageChange(1);
  }, [
    activeTab,
    stockFilter,
    statusFilter,
    collectionFilter,
    partTypeFilter,
    salesSort,
  ]);

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
      await handleFileChange(e, {
        mapFile: (url) => makeNewPreview(url, { category: activeTab }),
      });
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
        itemId: item.itemId || "",
        pricePerBag: Number(item.pricePerBag || 0).toFixed(2),
        piecesPerBag: item.piecesPerBag ?? 1,
        stock: item.stock,
        color: item.colorId?._id || item.colorId,
        category: item.category || activeTab,
        collectionId: item.collectionId?._id || item.collectionId || "",
        partType: item.partType || "",
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
      if (
        !validateGeneralInventory(
          filePreview,
          crud.dialogMode === "add",
          activeTab,
        )
      )
        return;

      const payload = {
        items: filePreview.map((item) => ({
          minifigName: sanitizeString(item.minifigName),
          itemId: sanitizeString(item.itemId) || null,
          pricePerBag: Number(item.pricePerBag),
          piecesPerBag: Number(item.piecesPerBag) || 1,
          stock: Number(item.stock),
          colorId: item.color,
          category: activeTab,
          collectionId: activeTab === "minifigs" ? item.collectionId : null,
          partType:
            activeTab === "bulk-minifig-parts" ? item.partType : null,
          image:
            typeof item.url === "string" && item.url.startsWith("data:")
              ? item.url
              : item.image,
        })),
      };

      await crud.submitForm(payload);
    } else {
      if (
        !validateGeneralInventory(
          filePreview,
          crud.dialogMode === "add",
          activeTab,
        )
      )
        return;

      const item = filePreview[0];

      const payload = {
        minifigName: sanitizeString(item.minifigName),
        itemId: sanitizeString(item.itemId) || null,
        pricePerBag: Number(item.pricePerBag),
        piecesPerBag: Number(item.piecesPerBag) || 1,
        stock: Number(item.stock),
        colorId: item.color,
        category: activeTab,
        collectionId: activeTab === "minifigs" ? item.collectionId : null,
        partType:
          activeTab === "bulk-minifig-parts" ? item.partType : null,
        isActive: crud.formData.isActive,
        ...(typeof item.url === "string" &&
          item.url.startsWith("data:") && { image: item.url }),
      };

      await crud.submitForm(payload);
    }
  };

  // Inline cost-note save — updates only the `cost` field, no dialog.
  const handleCostSave = useCallback(
    async (id, cost) => {
      try {
        await updateItem({ id, cost }).unwrap();
        toast.success("Cost updated");
      } catch (err) {
        toast.error(err?.data?.message || "Failed to update cost");
      }
    },
    [updateItem],
  );

  // Inline bin-note save — updates only the `bin` field, no dialog.
  const handleBinSave = useCallback(
    async (id, bin) => {
      try {
        await updateItem({ id, bin }).unwrap();
        toast.success("Bin updated");
      } catch (err) {
        toast.error(err?.data?.message || "Failed to update bin");
      }
    },
    [updateItem],
  );

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
      if (typeof index !== "number") {
        return (value) =>
          crud.setFormData((prev) => ({ ...prev, [field]: value }));
      }
      return getValueChangeHandler(field, index);
    },
    [crud.setFormData, getValueChangeHandler],
  );

  // ------------------------------- Return ------------------------------------
  return {
    ...crud,
    activeTab,
    setActiveTab,
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
    filePreview,
    fileInputRef,
    inventory,
    totalItems,
    totalPages,
    columns,
    colors,
    collections,
    isLoadingInventory,
    isLoadingColors,
    isLoadingCollections,
    isSubmitting,
    isDeleting,
    handleInventoryFileChange,
    handleInventoryFileRemove,
    getItemChangeHandler,
    handleEdit,
    handleSubmit,
    handleChange,
    handleValueChange,
    handleCostSave,
    handleBinSave,
  };
};

export default useGeneralInventoryManagement;
