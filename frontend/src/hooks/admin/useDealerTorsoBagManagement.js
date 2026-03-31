import { useEffect, useMemo, useCallback } from "react";
import {
  useGetDealerTorsoBagsQuery,
  useCreateDealerTorsoBagMutation,
  useUpdateDealerTorsoBagMutation,
  useDeleteDealerTorsoBagMutation,
  useGetDealerBundlesQuery,
} from "@/redux/api/adminApi";
import { extractPaginatedData } from "@/utils/apiHelpers";
import { sanitizeString, sortByName } from "@/utils/formatting";
import {
  validateDealerTorsoBag,
  validateTorsoAllocation,
  showTorsoAllocationWarning,
} from "@/utils/validation";
import useMediaPreview from "@/hooks/admin/useMediaPreview";
import useAdminCrud from "@/hooks/admin/useAdminCrud";

const getMiscQuantity = (bundleSize) => {
  if (bundleSize === 1000) return 80;
  if (bundleSize === 500) return 40;
  return 10;
};

const getAdminTarget = (target) => target - getMiscQuantity(target);

const initialFormData = {
  bagName: "",
  targetBundleSize: 100,
  isActive: true,
  items: [],
};

const columns = [
  { key: "bagName", label: "Bag Name" },
  { key: "targetBundleSize", label: "Target" },
  { key: "itemCount", label: "Total Designs" },
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

  const { data: bundlesData, isLoading: isLoadingBundles } =
    useGetDealerBundlesQuery({ limit: 100 });

  const {
    items: bags,
    totalItems,
    totalPages,
  } = extractPaginatedData(torsoBagData, "bags");

  const bundles = useMemo(
    () => sortByName(bundlesData?.bundles, "bundleName"),
    [bundlesData],
  );

  useEffect(() => {
    crud.setTotalItems(totalItems);
  }, [totalItems]);

  const isSubmitting = crud.isEditMode ? isUpdating : isCreating;

  const targetBundleSizeOptions = useMemo(() => {
    if (!bundles.length) return [{ value: 100, label: "100 Minifigs (Base)" }];

    const activeBundles = bundles.filter((b) => b.isActive);
    const sizes = new Set();

    const regularBundles = activeBundles.filter(
      (b) => (b.torsoBagType || "regular") === "regular",
    );

    if (regularBundles.length > 0) {
      const base = Math.min(...regularBundles.map((b) => b.minifigQuantity));
      sizes.add(base);
    }

    activeBundles
      .filter((b) => b.torsoBagType === "custom")
      .forEach((b) => sizes.add(b.minifigQuantity));

    if (sizes.size === 0) sizes.add(100);

    return [...sizes]
      .sort((a, b) => a - b)
      .map((size) => ({
        value: size,
        label: `${size} Minifigs`,
      }));
  }, [bundles]);

  const baseBundleSize = useMemo(() => {
    const regularBundles = bundles.filter(
      (b) => b.isActive && (b.torsoBagType || "regular") === "regular",
    );
    if (regularBundles.length === 0) return 100;
    return Math.min(...regularBundles.map((b) => b.minifigQuantity));
  }, [bundles]);

  const targetSize = Number(crud.formData.targetBundleSize) || 100;
  const miscQuantity = getMiscQuantity(targetSize);
  const adminTarget = getAdminTarget(targetSize);

  const currentTotal = useMemo(() => {
    return crud.formData.items.reduce(
      (acc, item) => acc + (Number(item.quantity) || 1),
      0,
    );
  }, [crud.formData.items]);

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
      targetBundleSize: bag.targetBundleSize || 100,
      isActive: bag.isActive !== false,
      items: existingItems,
    });
  };

  // ------------------------------- Media Handlers ------------------------------------
  const handleDealerTorsoBagFileChange = useCallback(
    async (e) => {
      let skippedCount = 0;

      const items = await onFileChange(e, {
        mapFile: (url) => {
          if (currentTotal + 1 > adminTarget) {
            skippedCount++;
            return null;
          }
          return {
            url,
            quantity: 1,
            image: { url },
          };
        },
      });

      const validItems = (items || []).filter(Boolean);

      if (skippedCount > 0) {
        showTorsoAllocationWarning(
          skippedCount,
          adminTarget,
          targetSize,
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
    [onFileChange, currentTotal, adminTarget, targetSize, miscQuantity],
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
        targetSize,
        miscQuantity,
      )
    )
      return;

    const items = crud.formData.items.map((item) => ({
      image:
        typeof item?.url === "string" && item.url.startsWith("data:")
          ? item.url
          : item?.image,
      quantity:
        item.quantity === "" || item.quantity == null
          ? 1
          : Number(item.quantity),
    }));

    const payload = {
      bagName: sanitizeString(crud.formData.bagName),
      targetBundleSize: targetSize,
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
    bundles,
    targetBundleSizeOptions,
    adminTarget,
    miscQuantity,
    currentTotal,
    isLoadingBags,
    isLoadingBundles,
    isSubmitting,
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
