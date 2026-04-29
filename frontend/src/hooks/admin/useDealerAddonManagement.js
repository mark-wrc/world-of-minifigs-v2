import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  useGetDealerAddonsQuery,
  useCreateDealerAddonMutation,
  useUpdateDealerAddonMutation,
  useDeleteDealerAddonMutation,
  useGetGeneralInventoryQuery,
  useGetCollectionsQuery,
} from "@/redux/api/adminApi";

export const ADDON_ITEM_CATEGORIES = [
  { value: "accessories", label: "Accessories" },
  { value: "animals", label: "Animals" },
  { value: "minifigs", label: "Minifigs" },
  { value: "printed-tiles", label: "Printed Tiles" },
];

import { extractPaginatedData } from "@/utils/apiHelpers";
import { sanitizeString, sortByName } from "@/utils/formatting";
import { validateDealerAddon } from "@/utils/validation";
import useAdminCrud from "@/hooks/admin/useAdminCrud";
import useMediaPreview from "@/hooks/admin/useMediaPreview";

const initialFormData = {
  addonName: "",
  addonType: "bundle",
  price: "",
  discount: "",
  badge: "",
  description: "",
  image: null,
  isActive: true,
};

const columns = [
  { key: "addonName", label: "Add-on" },
  { key: "addonType", label: "Type" },
  { key: "price", label: "Price" },
  { key: "discount", label: "Discount" },
  { key: "discountPrice", label: "Discounted Price" },
  { key: "isActive", label: "Status" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" },
  { key: "actions", label: "Actions" },
];

const DEBOUNCE_MS = 300;

const useDealerAddonManagement = () => {
  // ------------------------------- Bundle Items State ------------------------------------
  const [bundleItems, setBundleItems] = useState([]);

  // ------------------------------- Media ------------------------------------
  const {
    filePreview,
    setFilePreview,
    resetFile,
    handleFileChange,
    handleRemoveFile,
  } = useMediaPreview();

  // ------------------------------- Item Category Filter ------------------------------------
  const [itemCategory, setItemCategory] = useState("accessories");

  // ------------------------------- Inventory Search (debounced) ------------------------------------
  const [itemSearch, setItemSearch] = useState("");
  const [debouncedItemSearch, setDebouncedItemSearch] = useState("");
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedItemSearch(itemSearch);
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceTimer.current);
  }, [itemSearch]);

  const handleItemSearchChange = useCallback((e) => {
    setItemSearch(e.target.value);
  }, []);

  // ------------------------------- Mutations ------------------------------------
  const [createAddon, { isLoading: isCreating }] =
    useCreateDealerAddonMutation();
  const [updateAddon, { isLoading: isUpdating }] =
    useUpdateDealerAddonMutation();
  const [deleteAddon, { isLoading: isDeleting }] =
    useDeleteDealerAddonMutation();

  // ------------------------------- Core CRUD ------------------------------------
  const resetExtras = useCallback(() => {
    setBundleItems([]);
    resetFile();
  }, [resetFile]);

  const crud = useAdminCrud({
    initialFormData,
    createFn: createAddon,
    updateFn: updateAddon,
    deleteFn: deleteAddon,
    entityName: "add-on",
    onReset: resetExtras,
  });

  // ------------------------------- Fetch ------------------------------------
  const { data: addonsData, isLoading: isLoadingAddons } =
    useGetDealerAddonsQuery({
      page: crud.page,
      limit: crud.limit,
      search: crud.search || undefined,
    });

  const {
    data: inventoryData,
    isLoading: isInventoryLoading,
    isFetching: isInventoryFetching,
  } = useGetGeneralInventoryQuery({
    limit: "all",
    search: debouncedItemSearch || undefined,
    category: itemCategory,
  });

  const isLoadingInventory = isInventoryLoading || isInventoryFetching;

  const { data: collectionsData } = useGetCollectionsQuery({ limit: "all" });

  const {
    items: addons,
    totalItems,
    totalPages,
  } = extractPaginatedData(addonsData, "addons");

  const inventoryItems = (inventoryData?.inventory || []).filter(
    (item) => item.isActive !== false,
  );

  const selectedBundleItemIds = new Set(
    bundleItems.map((item) => item.inventoryItemId),
  );

  const sortedInventoryItems = useMemo(
    () => sortByName(inventoryItems, "minifigName"),
    [inventoryItems],
  );

  // For minifigs: group items by collection, returns [{collectionName, items:[]}]
  const groupedMinifigItems = useMemo(() => {
    if (itemCategory !== "minifigs") return null;
    const collectionMap = new Map();
    for (const item of sortedInventoryItems) {
      const colId = item.collectionId?._id || item.collectionId || null;
      const colName = item.collectionId?.collectionName || "Uncategorized";
      const key = colId || "__none__";
      if (!collectionMap.has(key)) {
        collectionMap.set(key, { collectionName: colName, items: [] });
      }
      collectionMap.get(key).items.push(item);
    }
    // Sort: named collections alphabetically, then Uncategorized last
    return [...collectionMap.entries()]
      .sort(([ka, a], [kb, b]) => {
        if (ka === "__none__") return 1;
        if (kb === "__none__") return -1;
        return a.collectionName.localeCompare(b.collectionName);
      })
      .map(([, group]) => group);
  }, [itemCategory, sortedInventoryItems]);

  const isBundleType = crud.formData.addonType === "bundle";
  const isUpgradeType = !isBundleType;

  const computedDiscountedPrice = useMemo(() => {
    if (!isUpgradeType) return null;
    const price = Number(crud.formData.price || 0);
    const discount = crud.formData.discount;
    if (discount === "" || discount === null || discount === undefined) return null;
    const pct = Math.min(100, Math.max(0, Number(discount)));
    return Math.max(0, price * (1 - pct / 100));
  }, [isUpgradeType, crud.formData.price, crud.formData.discount]);

  useEffect(() => {
    crud.setTotalItems(totalItems);
  }, [totalItems]);

  // Reset item search when category changes
  useEffect(() => {
    setItemSearch("");
    setDebouncedItemSearch("");
  }, [itemCategory]);

  const isSubmitting = crud.isEditMode ? isUpdating : isCreating;

  const bundleDisplayItems = bundleItems
    .filter((item) => item._item)
    .map((item) => ({
      ...item,
      inventory: item._item,
    }));

  // ------------------------------- Image Handlers ------------------------------------
  const handleAddonFileChange = useCallback(
    async (e) => {
      const dataUrl = await handleFileChange(e);
      if (dataUrl) {
        crud.setFormData((prev) => ({ ...prev, image: dataUrl }));
      }
    },
    [handleFileChange, crud],
  );

  const handleAddonFileRemove = useCallback(() => {
    handleRemoveFile();
    // null = explicit removal (controller deletes existing image)
    crud.setFormData((prev) => ({ ...prev, image: null }));
  }, [handleRemoveFile, crud]);

  // ------------------------------- Bundle Item Handlers ------------------------------------
  const handleToggleBundleItem = useCallback(
    (inventoryItemId, inventoryItem) => {
      setBundleItems((prev) => {
        const exists = prev.find((i) => i.inventoryItemId === inventoryItemId);
        if (exists) {
          return prev.filter((i) => i.inventoryItemId !== inventoryItemId);
        }
        return [
          {
            inventoryItemId,
            _item: inventoryItem,
          },
          ...prev,
        ];
      });
    },
    [],
  );

  const handleRemoveBundleItem = useCallback((inventoryItemId) => {
    setBundleItems((prev) =>
      prev.filter((i) => i.inventoryItemId !== inventoryItemId),
    );
  }, []);

  // ------------------------------- Edit Handler ------------------------------------
  const handleEdit = (addon) => {
    const existingItems =
      addon.bundleItems?.map((item) => {
        const populated = item.inventoryItemId || {};
        return {
          inventoryItemId: populated._id || item.inventoryItemId || "",
          _item: populated._id ? populated : null,
        };
      }) || [];

    setBundleItems(existingItems);

    const originalPrice = addon.addonType === "upgrade" ? (addon.price ?? "") : "";
    // Prefer the stored discount %; fall back to deriving it for legacy records
    // that were saved before `discount` existed.
    let discountField = "";
    if (addon.addonType === "upgrade") {
      if (addon.discount !== null && addon.discount !== undefined) {
        discountField = addon.discount;
      } else if (
        addon.discountPrice !== null &&
        addon.discountPrice !== undefined &&
        Number(addon.price) > 0
      ) {
        discountField = Math.round(
          (1 - Number(addon.discountPrice) / Number(addon.price)) * 100,
        );
      }
    }

    crud.openEdit(addon, {
      addonName: addon.addonName || "",
      addonType: addon.addonType || "bundle",
      price: originalPrice,
      discount: discountField,
      badge: addon.badge || "",
      description: addon.description || "",
      image: undefined, // undefined = no change to existing image
      isActive: addon.isActive !== false,
    });

    setFilePreview(addon.image?.url || null);
  };

  // ------------------------------- Submit Handler ------------------------------------
  const handleSubmit = async () => {
    const addonType = crud.formData.addonType;

    if (!validateDealerAddon(crud.formData, bundleItems)) return;

    const payload = {
      addonName: sanitizeString(crud.formData.addonName),
      addonType,
      description: sanitizeString(crud.formData.description),
      badge: crud.formData.badge?.trim() || null,
      isActive: crud.formData.isActive,
    };

    // Image: data-URL = upload new, null = explicit remove, undefined = leave alone
    if (crud.formData.image !== undefined) {
      payload.image = crud.formData.image;
    }

    if (addonType === "bundle") {
      payload.bundleItems = bundleItems.map((item) => ({
        inventoryItemId: item.inventoryItemId,
      }));
      payload.price = 0;
    } else {
      // Send the user-entered values; backend derives discountPrice as the
      // single source of truth so price + discount + discountPrice never drift.
      payload.price = Number(crud.formData.price || 0);
      const discount = crud.formData.discount;
      payload.discount =
        discount === "" || discount === null || discount === undefined
          ? null
          : Number(discount);
    }

    await crud.submitForm(payload);
  };

  // ------------------------------- Standard Handlers ------------------------------------
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

  // ------------------------------- Return ------------------------------------
  return {
    ...crud,
    addons,
    totalItems,
    totalPages,
    columns,
    inventoryItems,
    sortedInventoryItems,
    groupedMinifigItems,
    bundleItems,
    bundleDisplayItems,
    selectedBundleItemIds,
    isBundleType,
    isUpgradeType,
    computedDiscountedPrice,
    isLoadingAddons,
    isLoadingInventory,
    isSubmitting,
    isDeleting,
    itemSearch,
    itemCategory,
    setItemCategory,
    handleItemSearchChange,
    handleToggleBundleItem,
    handleRemoveBundleItem,
    handleEdit,
    handleSubmit,
    handleChange,
    handleValueChange,
    filePreview,
    handleAddonFileChange,
    handleAddonFileRemove,
  };
};

export default useDealerAddonManagement;
