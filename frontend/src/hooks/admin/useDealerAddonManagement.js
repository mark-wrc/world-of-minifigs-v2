import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  useGetDealerAddonsQuery,
  useCreateDealerAddonMutation,
  useUpdateDealerAddonMutation,
  useDeleteDealerAddonMutation,
  useGetGeneralInventoryQuery,
  useGetCollectionsQuery,
} from "@/redux/api/adminApi";
import { INVENTORY_CATEGORY_OPTIONS } from "@shared/inventoryData";

export const ADDON_ITEM_CATEGORIES = INVENTORY_CATEGORY_OPTIONS;

import { toast } from "sonner";
import { extractPaginatedData } from "@/utils/apiHelpers";
import { sanitizeString, sortByName } from "@/utils/formatting";
import { validateDealerAddon } from "@/utils/validation";
import {
  uploadImageToCloudinary,
  uploadImagesToCloudinary,
} from "@/utils/cloudinaryUpload";
import useAdminCrud from "@/hooks/admin/useAdminCrud";
import useMediaPreview from "@/hooks/admin/useMediaPreview";
import { BULK_MINIFIG_PART_TYPES } from "@shared/inventoryData";

// Cap the preview gallery so admins keep it digestible for dealers.
const MAX_PREVIEW_IMAGES = 8;

const initialFormData = {
  addonName: "",
  addonType: "bundle",
  visibleChannels: ["dealer", "wholesale"],
  price: "",
  discount: "",
  quantityMode: "single",
  maxQuantity: "",
  stock: "",
  badge: "",
  description: "",
  previewDescription: "",
  image: null,
  isActive: true,
};

// Per-order purchase policy options for upgrade add-ons.
export const ADDON_QUANTITY_MODE_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "limited", label: "Limited (up to a max)" },
  { value: "unlimited", label: "Unlimited" },
];

// Options for the "Show on" select. "both" maps to both channels.
export const ADDON_CHANNEL_SELECT_OPTIONS = [
  { value: "dealer", label: "Dealer" },
  { value: "wholesale", label: "Wholesale" },
  { value: "both", label: "Both" },
];

// Convert between the stored visibleChannels array and the single select value.
const channelsToSelectValue = (channels = []) => {
  const hasDealer = channels.includes("dealer");
  const hasWholesale = channels.includes("wholesale");
  if (hasDealer && hasWholesale) return "both";
  if (hasWholesale) return "wholesale";
  return "dealer";
};

const selectValueToChannels = (value) =>
  value === "both" ? ["dealer", "wholesale"] : [value];

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

  // Raw File for a newly-picked main image (uploaded to Cloudinary at submit).
  const [addonImageFile, setAddonImageFile] = useState(null);

  // Tracks the direct browser→Cloudinary upload happening before the save call.
  const [uploadProgress, setUploadProgress] = useState({
    isUploading: false,
    done: 0,
    total: 0,
  });

  // ------------------------------- Media ------------------------------------
  const {
    filePreview,
    setFilePreview,
    resetFile,
    handleFileChange,
    handleRemoveFile,
  } = useMediaPreview();

  // Preview gallery (upgrade-only). Reuses the shared multi-file hook so the
  // attach/validate/dedup behaviour matches the product "Image Attachments"
  // uploader. Each entry is either an existing image { publicId, url, label }
  // or a freshly-picked one { image: dataURL, url: dataURL (preview), label }.
  const {
    filePreview: previewImages,
    setFilePreview: setPreviewImages,
    resetFile: resetPreviewImages,
    handleFileChange: handlePreviewFileChange,
    handleRemoveFile: handleRemovePreviewImage,
  } = useMediaPreview({
    multiple: true,
    maxFiles: MAX_PREVIEW_IMAGES,
    maxSizeMB: 10,
  });

  // ------------------------------- Item Category Filter ------------------------------------
  const [itemCategory, setItemCategory] = useState("accessories");

  // Step the category filter to the previous/next tab (wraps around).
  // direction: +1 = next, -1 = previous.
  const selectAdjacentCategory = useCallback((direction) => {
    setItemCategory((current) => {
      const idx = ADDON_ITEM_CATEGORIES.findIndex((c) => c.value === current);
      if (idx === -1) return current;
      const count = ADDON_ITEM_CATEGORIES.length;
      return ADDON_ITEM_CATEGORIES[(idx + direction + count) % count].value;
    });
  }, []);

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
    setAddonImageFile(null);
    resetPreviewImages();
    resetFile();
  }, [resetFile, resetPreviewImages]);

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
      // A minifig can belong to several collections — list it under each.
      const cols = item.collectionIds?.length ? item.collectionIds : [null];
      for (const col of cols) {
        const colId = col?._id || col || null;
        const colName = col?.collectionName || "Uncategorized";
        const key = colId || "__none__";
        if (!collectionMap.has(key)) {
          collectionMap.set(key, { collectionName: colName, items: [] });
        }
        collectionMap.get(key).items.push(item);
      }
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

  // For bulk-minifig-parts: group items by partType, returns [{collectionName, items:[]}]
  const groupedBulkPartItems = useMemo(() => {
    if (itemCategory !== "bulk-minifig-parts") return null;
    const partMap = new Map();
    for (const item of sortedInventoryItems) {
      const key = item.partType || "__none__";
      if (!partMap.has(key)) {
        partMap.set(key, {
          collectionName: item.partType || "Uncategorized",
          items: [],
        });
      }
      partMap.get(key).items.push(item);
    }
    // Sort by the fixed enum order, with Uncategorized last
    return [
      ...BULK_MINIFIG_PART_TYPES.filter((name) => partMap.has(name)).map(
        (name) => partMap.get(name),
      ),
      ...(partMap.has("__none__") ? [partMap.get("__none__")] : []),
    ];
  }, [itemCategory, sortedInventoryItems]);

  const isBundleType = crud.formData.addonType === "bundle";
  const isUpgradeType = !isBundleType;

  const computedDiscountedPrice = useMemo(() => {
    if (!isUpgradeType) return null;
    const price = Number(crud.formData.price || 0);
    const discount = crud.formData.discount;
    if (discount === "" || discount === null || discount === undefined)
      return null;
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

  const isSubmitting =
    uploadProgress.isUploading || (crud.isEditMode ? isUpdating : isCreating);

  const bundleDisplayItems = bundleItems
    .filter((item) => item._item)
    .map((item) => ({
      ...item,
      inventory: item._item,
    }));

  // ------------------------------- Image Handlers ------------------------------------
  const handleAddonFileChange = useCallback(
    async (e) => {
      // Keep the raw File for direct upload; the data-URL is preview-only. We
      // still set formData.image to the data-URL as the "new image" signal
      // (data-URL = new, null = remove, undefined = leave alone).
      const dataUrl = await handleFileChange(e, {
        mapFile: (url, file) => {
          setAddonImageFile(file);
          return url;
        },
      });
      if (dataUrl) {
        crud.setFormData((prev) => ({ ...prev, image: dataUrl }));
      }
    },
    [handleFileChange, crud],
  );

  const handleAddonFileRemove = useCallback(() => {
    handleRemoveFile();
    setAddonImageFile(null);
    // null = explicit removal (controller deletes existing image)
    crud.setFormData((prev) => ({ ...prev, image: null }));
  }, [handleRemoveFile, crud]);

  // ------------------------------- Preview Gallery Handlers ----------------------------
  const handleAddPreviewImages = useCallback(
    async (e) => {
      // The shared hook reads/validates the files in this event handler (not in
      // a state updater), so attaching never double-fires under StrictMode.
      await handlePreviewFileChange(e, {
        // `url` is a preview-only data-URL; `file` uploads to Cloudinary at submit.
        mapFile: (url, file) => ({ url, label: "", file }),
      });
    },
    [handlePreviewFileChange],
  );

  const handlePreviewImageLabelChange = useCallback(
    (index, label) => {
      setPreviewImages((prev) =>
        prev.map((p, i) => (i === index ? { ...p, label } : p)),
      );
    },
    [setPreviewImages],
  );

  // ------------------------------- Bundle Item Handlers ------------------------------------
  const handleToggleBundleItem = useCallback(
    (inventoryItemId, inventoryItem) => {
      setBundleItems((prev) => {
        const exists = prev.find((i) => i.inventoryItemId === inventoryItemId);
        if (exists) {
          return prev.filter((i) => i.inventoryItemId !== inventoryItemId);
        }
        return [{ inventoryItemId, _item: inventoryItem }, ...prev];
      });
    },
    [],
  );

  const handleRemoveBundleItem = useCallback((inventoryItemId) => {
    setBundleItems((prev) =>
      prev.filter((i) => i.inventoryItemId !== inventoryItemId),
    );
  }, []);

  // Which channels the whole add-on shows on, driven by the "Show on" select.
  const handleChannelSelectChange = useCallback(
    (value) => {
      crud.setFormData((prev) => ({
        ...prev,
        visibleChannels: selectValueToChannels(value),
      }));
    },
    [crud],
  );

  const channelSelectValue = channelsToSelectValue(
    crud.formData.visibleChannels,
  );

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

    setPreviewImages(
      (addon.previewImages || []).map((p) => ({
        publicId: p.publicId,
        url: p.url,
        label: p.label || "",
      })),
    );

    const originalPrice =
      addon.addonType === "upgrade" ? (addon.price ?? "") : "";
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
      visibleChannels:
        addon.visibleChannels?.length > 0 ? addon.visibleChannels : ["dealer"],
      price: originalPrice,
      discount: discountField,
      quantityMode:
        addon.addonType === "upgrade"
          ? addon.quantityMode || "single"
          : "single",
      maxQuantity:
        addon.addonType === "upgrade" &&
        addon.quantityMode === "limited" &&
        addon.maxQuantity != null
          ? addon.maxQuantity
          : "",
      stock:
        addon.addonType === "upgrade" && addon.stock != null
          ? addon.stock
          : "",
      badge: addon.badge || "",
      description: addon.description || "",
      previewDescription:
        addon.addonType === "upgrade" ? addon.previewDescription || "" : "",
      image: undefined, // undefined = no change to existing image
      isActive: addon.isActive !== false,
    });

    setFilePreview(addon.image?.url || null);
  };

  // ------------------------------- Submit Handler ------------------------------------
  const handleSubmit = async () => {
    const addonType = crud.formData.addonType;

    if (!validateDealerAddon(crud.formData, bundleItems)) return;

    // --- Upload any newly-picked images directly to Cloudinary first ---
    const hasNewMainImage =
      crud.formData.image !== undefined &&
      crud.formData.image !== null &&
      !!addonImageFile;

    const newPreviewEntries =
      addonType !== "bundle"
        ? previewImages
            .map((p, i) => ({ p, i }))
            .filter(({ p }) => !p.publicId && p.file)
        : [];

    const totalUploads = (hasNewMainImage ? 1 : 0) + newPreviewEntries.length;

    let mainImageRef;
    const previewRefByIndex = new Map();

    if (totalUploads > 0) {
      const base = hasNewMainImage ? 1 : 0;
      setUploadProgress({ isUploading: true, done: 0, total: totalUploads });
      try {
        if (hasNewMainImage) {
          mainImageRef = await uploadImageToCloudinary(
            addonImageFile,
            "dealer-addon",
          );
          setUploadProgress({ isUploading: true, done: 1, total: totalUploads });
        }
        if (newPreviewEntries.length > 0) {
          const refs = await uploadImagesToCloudinary(
            newPreviewEntries.map(({ p }) => p.file),
            "dealer-addon-preview",
            {
              onProgress: (completed) =>
                setUploadProgress({
                  isUploading: true,
                  done: base + completed,
                  total: totalUploads,
                }),
            },
          );
          newPreviewEntries.forEach(({ i }, k) =>
            previewRefByIndex.set(i, refs[k]),
          );
        }
      } catch (error) {
        setUploadProgress({ isUploading: false, done: 0, total: 0 });
        toast.error("Image upload failed", {
          description: error?.message || "Could not upload images.",
        });
        return;
      }
      setUploadProgress({ isUploading: false, done: 0, total: 0 });
    }

    const payload = {
      addonName: sanitizeString(crud.formData.addonName),
      addonType,
      visibleChannels: crud.formData.visibleChannels,
      description: sanitizeString(crud.formData.description),
      badge: crud.formData.badge?.trim() || null,
      isActive: crud.formData.isActive,
    };

    // Image: new upload = ref, null = explicit remove, undefined = leave alone
    if (crud.formData.image === null) {
      payload.image = null;
    } else if (mainImageRef) {
      payload.image = mainImageRef;
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

      // Per-order purchase policy. maxQuantity is only sent for "limited".
      const quantityMode = crud.formData.quantityMode || "single";
      payload.quantityMode = quantityMode;
      payload.maxQuantity =
        quantityMode === "limited"
          ? Number(crud.formData.maxQuantity || 0)
          : null;

      // Optional finite stock. Empty = untracked (sells without a limit).
      const stockVal = crud.formData.stock;
      payload.stock =
        stockVal === "" || stockVal === null || stockVal === undefined
          ? null
          : Number(stockVal);

      // Optional preview-modal description (falls back to `description` client-side).
      payload.previewDescription = sanitizeString(
        crud.formData.previewDescription,
      );

      // Preview gallery — every entry is now an uploaded ref { publicId, url }
      // (existing entries as-is; new ones resolved from the uploads above).
      // Labels ride alongside each entry.
      payload.previewImages = previewImages.map((p, i) => {
        const ref = p.publicId ? p : previewRefByIndex.get(i);
        return {
          publicId: ref?.publicId,
          url: ref?.url,
          label: p.label?.trim() || "",
        };
      });
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
    groupedBulkPartItems,
    bundleItems,
    bundleDisplayItems,
    selectedBundleItemIds,
    isBundleType,
    isUpgradeType,
    computedDiscountedPrice,
    isLoadingAddons,
    isLoadingInventory,
    isSubmitting,
    uploadProgress,
    isDeleting,
    itemSearch,
    itemCategory,
    setItemCategory,
    selectAdjacentCategory,
    handleItemSearchChange,
    handleToggleBundleItem,
    handleRemoveBundleItem,
    handleChannelSelectChange,
    channelSelectValue,
    handleEdit,
    handleSubmit,
    handleChange,
    handleValueChange,
    filePreview,
    handleAddonFileChange,
    handleAddonFileRemove,
    previewImages,
    maxPreviewImages: MAX_PREVIEW_IMAGES,
    handleAddPreviewImages,
    handleRemovePreviewImage,
    handlePreviewImageLabelChange,
  };
};

export default useDealerAddonManagement;
