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
];

import { extractPaginatedData } from "@/utils/apiHelpers";
import { sanitizeString, sortByName } from "@/utils/formatting";
import { validateDealerAddon } from "@/utils/validation";
import useAdminCrud from "@/hooks/admin/useAdminCrud";

const initialFormData = {
  addonName: "",
  addonType: "bundle",
  price: "",
  discount: "",
  badge: "",
  description: "",
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
  const resetBundleItems = useCallback(() => setBundleItems([]), []);

  const crud = useAdminCrud({
    initialFormData,
    createFn: createAddon,
    updateFn: updateAddon,
    deleteFn: deleteAddon,
    entityName: "add-on",
    onReset: resetBundleItems,
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
            quantityPerBag: 1,
            pricePerBag: Number(inventoryItem.price || 0).toFixed(2),
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

  const handleBundleItemPricePerBag = useCallback((inventoryItemId, value) => {
    setBundleItems((prev) =>
      prev.map((item) =>
        item.inventoryItemId === inventoryItemId
          ? { ...item, pricePerBag: value }
          : item,
      ),
    );
  }, []);

  const handleBundleItemQuantityValue = useCallback(
    (inventoryItemId, value) => {
      setBundleItems((prev) =>
        prev.map((item) => {
          if (item.inventoryItemId !== inventoryItemId) return item;
          const newQty = value === "" ? "" : Math.max(1, Number(value) || 1);
          const suggestedPrice =
            newQty === "" ? item.pricePerBag : Number((item._item?.price || 0) * newQty).toFixed(2);
          return { ...item, quantityPerBag: newQty, pricePerBag: suggestedPrice };
        }),
      );
    },
    [],
  );

  // ------------------------------- Edit Handler ------------------------------------
  const handleEdit = (addon) => {
    const existingItems =
      addon.bundleItems?.map((item) => {
        const populated = item.inventoryItemId || {};
        return {
          inventoryItemId: populated._id || item.inventoryItemId || "",
          quantityPerBag: item.quantityPerBag || 1,
          pricePerBag: Number(item.pricePerBag ?? (populated.price || 0) * (item.quantityPerBag || 1)).toFixed(2),
          _item: populated._id ? populated : null,
        };
      }) || [];

    setBundleItems(existingItems);

    const originalPrice = addon.addonType === "upgrade" ? (addon.price ?? "") : "";
    const discountPrice = addon.addonType === "upgrade" ? (addon.discountPrice ?? "") : "";
    const computedDiscount =
      originalPrice !== "" && discountPrice !== "" && Number(originalPrice) > 0
        ? Math.round((1 - Number(discountPrice) / Number(originalPrice)) * 100)
        : "";

    crud.openEdit(addon, {
      addonName: addon.addonName || "",
      addonType: addon.addonType || "bundle",
      price: originalPrice,
      discount: computedDiscount,
      badge: addon.badge || "",
      description: addon.description || "",
      isActive: addon.isActive !== false,
    });
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

    if (addonType === "bundle") {
      payload.bundleItems = bundleItems.map((item) => ({
        inventoryItemId: item.inventoryItemId,
        quantityPerBag: Number(item.quantityPerBag),
        pricePerBag: Number(item.pricePerBag) || 0,
      }));
      payload.price = 0;
    } else {
      const originalPrice = Number(crud.formData.price || 0);
      payload.price = originalPrice;
      const discount = crud.formData.discount;
      if (discount !== "" && discount !== null && discount !== undefined) {
        const pct = Math.min(100, Math.max(0, Number(discount)));
        payload.discountPrice = Math.max(0, originalPrice * (1 - pct / 100));
      } else {
        payload.discountPrice = null;
      }
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
    handleBundleItemQuantityValue,
    handleBundleItemPricePerBag,
    handleEdit,
    handleSubmit,
    handleChange,
    handleValueChange,
  };
};

export default useDealerAddonManagement;
