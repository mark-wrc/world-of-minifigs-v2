import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useGetDealerTorsoBagsQuery,
  useCreateDealerTorsoBagMutation,
  useUpdateDealerTorsoBagMutation,
  useDeleteDealerTorsoBagMutation,
  useGetGeneralInventoryQuery,
} from "@/redux/api/adminApi";
import { extractPaginatedData } from "@/utils/apiHelpers";
import {
  nextIncrementedName,
  sanitizeString,
  sortByName,
} from "@/utils/formatting";
import {
  validateDealerTorsoBag,
  validateTorsoAllocation,
} from "@/utils/validation";
import { TORSO_PART_TYPES } from "@shared/inventoryData";
import useAdminCrud from "@/hooks/admin/useAdminCrud";

// Misc-per-bag for each base size. Same constants as backend/services/bundleService.js.
const MISC_PER_BAG = { 100: 10, 500: 40 };
const getAdminTarget = (base) => base - (MISC_PER_BAG[base] ?? 0);

const BASE_SIZE_OPTIONS = [
  { value: 100, label: "100" },
  { value: 500, label: "500" },
];

const DEBOUNCE_MS = 300;

// Each item references a torso in General Inventory. Shape while editing:
//   { inventoryItemId, quantity, _item }        — a linked torso
//   { inventoryItemId: null, quantity, legacyImage } — a pre-migration image
//     that must be re-linked to inventory before the bag can be saved.
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

// Maps a saved bag's items into the editing shape used by the form. Shared by
// edit and duplicate so a copy carries the exact same torsos and quantities.
const mapBagItems = (bag) =>
  bag.items?.map((item) => {
    const inv = item.inventoryItemId;
    // Populated reference → a linked torso row.
    if (inv && typeof inv === "object" && inv._id) {
      return {
        inventoryItemId: inv._id,
        quantity: item.quantity || 1,
        _item: inv,
      };
    }
    // Bare id (inventory got unpopulated somehow) → keep the id.
    if (inv) {
      return { inventoryItemId: inv, quantity: item.quantity || 1, _item: null };
    }
    // Legacy embedded-image item → needs re-linking before save.
    return {
      inventoryItemId: null,
      quantity: item.quantity || 1,
      legacyImage: item.image || null,
      _item: null,
    };
  }) || [];

const useDealerTorsoBagManagement = () => {
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
  });

  // ------------------------------- Fetch bags ------------------------------------
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

  // ------------------------------- Torso inventory (debounced search) -----------
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

  const {
    data: inventoryData,
    isLoading: isInventoryLoading,
    isFetching: isInventoryFetching,
  } = useGetGeneralInventoryQuery({
    limit: "all",
    search: debouncedItemSearch || undefined,
    category: "bulk-minifig-parts",
    // Filter to torso part types server-side so all torsos come back in one page
    // (the server caps a page at 100; fetching all bulk parts would truncate).
    partTypes: TORSO_PART_TYPES.join(","),
  });

  const isLoadingInventory = isInventoryLoading || isInventoryFetching;

  // Show every torso in inventory regardless of active/stock status — a torso
  // bag is a curated set, so the individual torso's sell-status is irrelevant.
  const torsoInventory = useMemo(
    () =>
      (inventoryData?.inventory || []).filter((item) =>
        TORSO_PART_TYPES.includes(item.partType),
      ),
    [inventoryData],
  );

  // Group torsos by their part type ("Printed Torso" / "Solid Color Torso").
  const groupedTorsoItems = useMemo(() => {
    const sorted = sortByName(torsoInventory, "minifigName");
    return TORSO_PART_TYPES.map((partType) => ({
      partType,
      items: sorted.filter((item) => item.partType === partType),
    })).filter((group) => group.items.length > 0);
  }, [torsoInventory]);

  const selectedItemIds = useMemo(
    () => new Set(crud.formData.items.map((i) => i.inventoryItemId)),
    [crud.formData.items],
  );

  // ------------------------------- Allocation ------------------------------------
  const baseSize = Number(crud.formData.baseSize) || 100;
  const miscQuantity = MISC_PER_BAG[baseSize] ?? 0;
  const adminTarget = getAdminTarget(baseSize);

  const currentTotal = crud.formData.items.reduce(
    (acc, item) => acc + (Number(item.quantity) || 0),
    0,
  );

  const isSubmitting = crud.isEditMode ? isUpdating : isCreating;

  // ------------------------------- Edit Handler ----------------------------------
  const handleEdit = (bag) => {
    crud.openEdit(bag, {
      bagName: bag.bagName || "",
      baseSize: bag.baseSize || 100,
      stock: bag.stock ?? 0,
      isActive: bag.isActive !== false,
      items: mapBagItems(bag),
    });
  };

  // ------------------------------- Duplicate Handler -----------------------------
  // Opens the Add dialog pre-filled with a copy of the bag — same base size,
  // stock, status and torsos (with their quantities) — under the next name in
  // the sequence ("Bag 5001" → "Bag 5002"). Nothing is saved until the admin
  // submits, so every field stays editable, name included. Names on the current
  // page are skipped when picking the number; the backend still rejects a
  // collision with a bag on another page.
  const handleDuplicate = (bag) => {
    crud.handleAdd({
      bagName: nextIncrementedName(
        bag.bagName,
        bags.map((b) => b.bagName),
      ),
      baseSize: bag.baseSize || 100,
      stock: bag.stock ?? 0,
      isActive: bag.isActive !== false,
      items: mapBagItems(bag),
    });

    toast.info("Duplicating bag", {
      description: `Review the copy of "${bag.bagName}" and save to create it.`,
    });
  };

  // ------------------------------- Item Handlers ---------------------------------
  const handleToggleTorso = useCallback(
    (inventoryItem) => {
      const id = inventoryItem._id;
      const already = crud.formData.items.some(
        (i) => i.inventoryItemId === id,
      );

      if (already) {
        crud.setFormData((prev) => ({
          ...prev,
          items: prev.items.filter((i) => i.inventoryItemId !== id),
        }));
        return;
      }

      if (currentTotal >= adminTarget) {
        toast.warning("Allocation full", {
          description: `This bag already totals ${adminTarget} designs. Lower a quantity before adding another torso.`,
        });
        return;
      }

      crud.setFormData((prev) => ({
        ...prev,
        items: [
          { inventoryItemId: id, quantity: 1, _item: inventoryItem },
          ...prev.items,
        ],
      }));
    },
    [crud, currentTotal, adminTarget],
  );

  const handleRemoveItemAt = useCallback(
    (index) => {
      crud.setFormData((prev) => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      }));
    },
    [crud],
  );

  const handleUpdateItemQuantity = (index) => (e) => {
    const value = e?.target ? e.target.value : e;
    const strValue = value.toString();

    // Allow empty string so the user can clear the input while typing.
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
      (acc, item, i) => (i === index ? acc : acc + (Number(item.quantity) || 0)),
      0,
    );

    if (!validateTorsoAllocation(otherItemsTotal, newValue, adminTarget)) return;

    crud.setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], quantity: newValue };
      return { ...prev, items: newItems };
    });
  };

  // ------------------------------- Submit ----------------------------------------
  const handleSubmit = async () => {
    if (
      !validateDealerTorsoBag(crud.formData, adminTarget, baseSize, miscQuantity)
    )
      return;

    // Every row must reference an inventory torso — block on un-relinked legacy rows.
    const unlinked = crud.formData.items.some((item) => !item.inventoryItemId);
    if (unlinked) {
      toast.error("Re-link required", {
        description:
          "Some designs still point to old uploaded images. Replace them with a torso from inventory before saving.",
      });
      return;
    }

    const items = crud.formData.items.map((item) => ({
      inventoryItemId: item.inventoryItemId,
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

  // ------------------------------- Standard Handlers -----------------------------
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

  // ------------------------------- Return ----------------------------------------
  return {
    ...crud,
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
    isDeleting,
    // Inventory picker
    groupedTorsoItems,
    selectedItemIds,
    isLoadingInventory,
    itemSearch,
    handleItemSearchChange,
    handleToggleTorso,
    handleRemoveItemAt,
    // Item + form handlers
    handleEdit,
    handleDuplicate,
    handleUpdateItemQuantity,
    handleSubmit,
    handleChange,
    handleValueChange,
  };
};

export default useDealerTorsoBagManagement;
