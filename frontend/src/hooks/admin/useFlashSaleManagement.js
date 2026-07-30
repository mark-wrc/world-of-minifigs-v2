import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  useGetFlashSalesQuery,
  useCreateFlashSaleMutation,
  useUpdateFlashSaleMutation,
  useDeleteFlashSaleMutation,
  useDuplicateFlashSaleMutation,
  useGetGeneralInventoryQuery,
} from "@/redux/api/adminApi";
import {
  INVENTORY_CATEGORY_OPTIONS,
  BULK_MINIFIG_PART_TYPES,
} from "@shared/inventoryData";
import { extractPaginatedData } from "@/utils/apiHelpers";
import {
  sanitizeString,
  sortByName,
  sanitizeDecimalInput,
} from "@/utils/formatting";
import useAdminCrud from "@/hooks/admin/useAdminCrud";

export const FLASH_SALE_ITEM_CATEGORIES = INVENTORY_CATEGORY_OPTIONS;

export const DISCOUNT_TYPE_OPTIONS = [
  { value: "percent", label: "% off" },
  { value: "fixed", label: "$ off" },
];

export const FLASH_SALE_STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Scheduled" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
];

const DEBOUNCE_MS = 300;

const initialFormData = {
  name: "",
  startAt: "",
  endAt: "",
  isEnabled: true,
};

const columns = [
  { key: "name", label: "Name" },
  { key: "window", label: "Window" },
  { key: "itemCount", label: "Items" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created At" },
  { key: "actions", label: "Actions" },
];

// Compute the discounted price for the live preview (mirrors the backend:
// percent may reach $0.00 for a 100%-off freebie; fixed $ is floored at 0.01).
export const previewSalePrice = (basePrice, discountType, discountValue) => {
  const base = Number(basePrice) || 0;
  const value = Number(discountValue) || 0;
  if (discountType === "percent") {
    return Math.max(Math.round(base * (1 - value / 100) * 100) / 100, 0);
  }
  return Math.max(Math.round((base - value) * 100) / 100, 0.01);
};

// <input type="datetime-local"> works in local time with no zone suffix.
// Convert a stored ISO string → local "YYYY-MM-DDTHH:mm" for the input.
const isoToLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

// Local input string → ISO (UTC) for the API. The Date constructor reads the
// naive local string as local time, which is what the admin intends.
const localInputToIso = (local) => {
  if (!local) return null;
  const d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const useFlashSaleManagement = () => {
  // Participants being edited: { inventoryItemId, discountType, discountValue, _item }
  const [saleItems, setSaleItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");

  // ---- Inventory picker state (category tabs + debounced search) ----
  const [itemCategory, setItemCategory] = useState("accessories");
  const [itemSearch, setItemSearch] = useState("");
  const [debouncedItemSearch, setDebouncedItemSearch] = useState("");
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(
      () => setDebouncedItemSearch(itemSearch),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(debounceTimer.current);
  }, [itemSearch]);

  const handleItemSearchChange = useCallback((e) => {
    setItemSearch(e.target.value);
  }, []);

  // Switch tab and clear the item search in one step — done here (not in an
  // effect) so it doesn't trigger a cascading re-render.
  const changeItemCategory = useCallback((cat) => {
    setItemCategory(cat);
    setItemSearch("");
    setDebouncedItemSearch("");
  }, []);

  const selectAdjacentCategory = useCallback((direction) => {
    setItemCategory((current) => {
      const idx = FLASH_SALE_ITEM_CATEGORIES.findIndex(
        (c) => c.value === current,
      );
      if (idx === -1) return current;
      const count = FLASH_SALE_ITEM_CATEGORIES.length;
      const next =
        FLASH_SALE_ITEM_CATEGORIES[(idx + direction + count) % count].value;
      return next;
    });
    setItemSearch("");
    setDebouncedItemSearch("");
  }, []);

  // ---- Mutations ----
  const [createFlashSale, { isLoading: isCreating }] =
    useCreateFlashSaleMutation();
  const [updateFlashSale, { isLoading: isUpdating }] =
    useUpdateFlashSaleMutation();
  const [deleteFlashSale, { isLoading: isDeleting }] =
    useDeleteFlashSaleMutation();
  const [duplicateFlashSale, { isLoading: isDuplicating }] =
    useDuplicateFlashSaleMutation();

  const resetExtras = useCallback(() => {
    setSaleItems([]);
    setItemSearch("");
    setDebouncedItemSearch("");
    setItemCategory("accessories");
  }, []);

  const crud = useAdminCrud({
    initialFormData,
    createFn: createFlashSale,
    updateFn: updateFlashSale,
    deleteFn: deleteFlashSale,
    entityName: "flash sale",
    onReset: resetExtras,
  });

  // ---- Fetch sales ----
  const { data: salesData, isLoading: isLoadingSales } = useGetFlashSalesQuery({
    page: crud.page,
    limit: crud.limit,
    search: crud.search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  // ---- Fetch inventory for the picker ----
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

  const {
    items: flashSales,
    totalItems,
    totalPages,
  } = extractPaginatedData(salesData, "flashSales");

  useEffect(() => {
    crud.setTotalItems(totalItems);
  }, [totalItems]);

  const inventoryItems = (inventoryData?.inventory || []).filter(
    (item) => item.isActive !== false,
  );

  const sortedInventoryItems = useMemo(
    () => sortByName(inventoryItems, "minifigName"),
    [inventoryItems],
  );

  const selectedItemIds = useMemo(
    () => new Set(saleItems.map((i) => i.inventoryItemId)),
    [saleItems],
  );

  const groupedMinifigItems = useMemo(() => {
    if (itemCategory !== "minifigs") return null;
    const map = new Map();
    for (const item of sortedInventoryItems) {
      const cols = item.collectionIds?.length ? item.collectionIds : [null];
      for (const col of cols) {
        const colId = col?._id || col || null;
        const colName = col?.collectionName || "Uncategorized";
        const key = colId || "__none__";
        if (!map.has(key)) map.set(key, { collectionName: colName, items: [] });
        map.get(key).items.push(item);
      }
    }
    return [...map.entries()]
      .sort(([ka, a], [kb, b]) => {
        if (ka === "__none__") return 1;
        if (kb === "__none__") return -1;
        return a.collectionName.localeCompare(b.collectionName);
      })
      .map(([, group]) => group);
  }, [itemCategory, sortedInventoryItems]);

  const groupedBulkPartItems = useMemo(() => {
    if (itemCategory !== "bulk-minifig-parts") return null;
    const map = new Map();
    for (const item of sortedInventoryItems) {
      const key = item.partType || "__none__";
      if (!map.has(key)) {
        map.set(key, {
          collectionName: item.partType || "Uncategorized",
          items: [],
        });
      }
      map.get(key).items.push(item);
    }
    return [
      ...BULK_MINIFIG_PART_TYPES.filter((name) => map.has(name)).map((name) =>
        map.get(name),
      ),
      ...(map.has("__none__") ? [map.get("__none__")] : []),
    ];
  }, [itemCategory, sortedInventoryItems]);

  // Selected items joined with their inventory doc for rendering.
  const saleDisplayItems = useMemo(
    () => saleItems.filter((i) => i._item).map((i) => ({ ...i, inventory: i._item })),
    [saleItems],
  );

  const isSubmitting = crud.isEditMode ? isUpdating : isCreating;

  // ---- Item handlers ----
  const handleToggleItem = useCallback((inventoryItemId, inventoryItem) => {
    setSaleItems((prev) => {
      const exists = prev.find((i) => i.inventoryItemId === inventoryItemId);
      if (exists) {
        return prev.filter((i) => i.inventoryItemId !== inventoryItemId);
      }
      // New items default to 10% off — admin adjusts per item.
      return [
        {
          inventoryItemId,
          discountType: "percent",
          discountValue: "10",
          _item: inventoryItem,
        },
        ...prev,
      ];
    });
  }, []);

  const handleRemoveItem = useCallback((inventoryItemId) => {
    setSaleItems((prev) =>
      prev.filter((i) => i.inventoryItemId !== inventoryItemId),
    );
  }, []);

  const handleItemDiscountTypeChange = useCallback((inventoryItemId, type) => {
    setSaleItems((prev) =>
      prev.map((i) => {
        if (i.inventoryItemId !== inventoryItemId) return i;
        if (i.discountType === type) return i;
        // Switching units (% ↔ $) makes the old number meaningless — e.g. "20"
        // is a fine percentage but "$20 off" on a cheaper item goes negative and
        // hits the floor. Clear it so the admin enters a value for the new unit.
        return { ...i, discountType: type, discountValue: "" };
      }),
    );
  }, []);

  const handleItemDiscountValueChange = useCallback((inventoryItemId, value) => {
    setSaleItems((prev) =>
      prev.map((i) => {
        if (i.inventoryItemId !== inventoryItemId) return i;
        const max = i.discountType === "percent" ? 100 : undefined;
        return { ...i, discountValue: sanitizeDecimalInput(value, { max }) };
      }),
    );
  }, []);

  // Apply one discount to every selected item at once.
  const handleBulkApplyDiscount = useCallback((type, value) => {
    const max = type === "percent" ? 100 : undefined;
    const clean = sanitizeDecimalInput(String(value), { max });
    setSaleItems((prev) =>
      prev.map((i) => ({ ...i, discountType: type, discountValue: clean })),
    );
  }, []);

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

  // ---- Edit ----
  const handleEdit = (sale) => {
    const existing = (sale.items || []).map((it) => {
      const populated = it.inventoryItemId || {};
      return {
        inventoryItemId: populated._id || it.inventoryItemId || "",
        discountType: it.discountType || "percent",
        discountValue: String(it.discountValue ?? ""),
        _item: populated._id ? populated : null,
      };
    });
    setSaleItems(existing);

    crud.openEdit(sale, {
      name: sale.name || "",
      startAt: isoToLocalInput(sale.startAt),
      endAt: isoToLocalInput(sale.endAt),
      isEnabled: sale.isEnabled !== false,
    });
  };

  // ---- Duplicate ----
  const handleDuplicate = async (sale) => {
    try {
      const res = await duplicateFlashSale(sale._id).unwrap();
      if (res.success) {
        toast.success("Flash sale duplicated", {
          description: "Set its window and enable it when ready.",
        });
      }
    } catch (error) {
      toast.error("Failed to duplicate", {
        description: error?.data?.description || "Please try again.",
      });
    }
  };

  // ---- Submit ----
  const handleSubmit = async () => {
    const name = sanitizeString(crud.formData.name);
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const startIso = localInputToIso(crud.formData.startAt);
    const endIso = localInputToIso(crud.formData.endAt);
    if (!startIso || !endIso) {
      toast.error("Set a valid start and end date/time");
      return;
    }
    if (new Date(endIso) <= new Date(startIso)) {
      toast.error("End must be after start");
      return;
    }
    if (saleItems.length === 0) {
      toast.error("Add at least one item to the sale");
      return;
    }

    // Validate each discount value before sending.
    for (const it of saleItems) {
      const val = Number(it.discountValue);
      if (isNaN(val) || val <= 0) {
        toast.error(`Enter a discount for "${it._item?.minifigName || "item"}"`);
        return;
      }
      if (it.discountType === "percent" && val > 100) {
        toast.error(`Percentage can't exceed 100% for "${it._item?.minifigName}"`);
        return;
      }
      if (
        it.discountType === "fixed" &&
        it._item &&
        val >= Number(it._item.pricePerBag)
      ) {
        toast.error(
          `Fixed discount must be less than the price for "${it._item.minifigName}"`,
        );
        return;
      }
    }

    const payload = {
      name,
      startAt: startIso,
      endAt: endIso,
      isEnabled: crud.formData.isEnabled,
      items: saleItems.map((i) => ({
        inventoryItemId: i.inventoryItemId,
        discountType: i.discountType,
        discountValue: Number(i.discountValue),
      })),
    };

    await crud.submitForm(payload);
  };

  return {
    ...crud,
    flashSales,
    totalItems,
    totalPages,
    columns,
    statusFilter,
    setStatusFilter,
    // inventory picker
    sortedInventoryItems,
    groupedMinifigItems,
    groupedBulkPartItems,
    selectedItemIds,
    itemCategory,
    setItemCategory: changeItemCategory,
    selectAdjacentCategory,
    itemSearch,
    handleItemSearchChange,
    isLoadingInventory,
    // sale items
    saleItems,
    saleDisplayItems,
    handleToggleItem,
    handleRemoveItem,
    handleItemDiscountTypeChange,
    handleItemDiscountValueChange,
    handleBulkApplyDiscount,
    // form
    isLoadingSales,
    isSubmitting,
    isDeleting,
    isDuplicating,
    handleChange,
    handleValueChange,
    handleEdit,
    handleDuplicate,
    handleSubmit,
  };
};

export default useFlashSaleManagement;
