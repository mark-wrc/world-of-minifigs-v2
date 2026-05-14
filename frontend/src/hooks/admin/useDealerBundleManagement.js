import { useEffect } from "react";
import {
  useGetDealerBundlesQuery,
  useCreateDealerBundleMutation,
  useUpdateDealerBundleMutation,
  useDeleteDealerBundleMutation,
} from "@/redux/api/adminApi";
import { extractPaginatedData } from "@/utils/apiHelpers";
import { cleanFeatures, sanitizeString } from "@/utils/formatting";
import { toast } from "sonner";
import { validateDealerBundle } from "@/utils/validation";
import useAdminCrud from "@/hooks/admin/useAdminCrud";

const initialFormData = {
  bundleName: "",
  minifigQuantity: "",
  unitPrice: "",
  baseSize: 100,
  isActive: true,
  features: [""],
};

const columns = [
  { key: "bundleName", label: "Bundle" },
  { key: "baseSize", label: "Base Size" },
  { key: "minifigQuantity", label: "Quantity" },
  { key: "unitPrice", label: "Unit Price" },
  { key: "totalPrice", label: "Total Price" },
  { key: "isActive", label: "Status" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" },
  { key: "actions", label: "Actions" },
];

const useDealerBundleManagement = () => {
  // ------------------------------- Mutations ------------------------------------
  const [createBundle, { isLoading: isCreating }] =
    useCreateDealerBundleMutation();
  const [updateBundle, { isLoading: isUpdating }] =
    useUpdateDealerBundleMutation();
  const [deleteBundle, { isLoading: isDeleting }] =
    useDeleteDealerBundleMutation();

  // ------------------------------- Core CRUD ------------------------------------
  const crud = useAdminCrud({
    initialFormData,
    createFn: createBundle,
    updateFn: updateBundle,
    deleteFn: deleteBundle,
    entityName: "bundle",
  });

  // ------------------------------- Fetch ------------------------------------
  const { data: bundlesData, isLoading: isLoadingBundles } =
    useGetDealerBundlesQuery({
      page: crud.page,
      limit: crud.limit,
      search: crud.search || undefined,
    });

  const {
    items: bundles,
    totalItems,
    totalPages,
  } = extractPaginatedData(bundlesData, "bundles");

  useEffect(() => {
    crud.setTotalItems(totalItems);
  }, [totalItems]);

  const isSubmitting = crud.isEditMode ? isUpdating : isCreating;

  const calculatedTotal =
    Number(crud.formData.minifigQuantity || 0) *
    Number(crud.formData.unitPrice || 0);

  // ------------------------------- Edit Handler ------------------------------------
  const handleEdit = (bundle) => {
    crud.openEdit(bundle, {
      bundleName: bundle.bundleName || "",
      minifigQuantity: bundle.minifigQuantity || "",
      unitPrice: bundle.unitPrice || "",
      baseSize: bundle.baseSize || 100,
      isActive: bundle.isActive !== false,
      features:
        bundle.features && bundle.features.length > 0 ? bundle.features : [""],
    });
  };

  // ------------------------------- Submit Handler ------------------------------------
  const handleSubmit = async () => {
    if (!validateDealerBundle(crud.formData)) return;

    const qty = Number(crud.formData.minifigQuantity);
    const base = Number(crud.formData.baseSize);
    if (qty % base !== 0) {
      toast.error("Invalid bundle size", {
        description: `Quantity (${qty}) must be a multiple of the base bag size (${base}).`,
      });
      return;
    }

    const payload = {
      bundleName: sanitizeString(crud.formData.bundleName),
      minifigQuantity: qty,
      unitPrice: Number(crud.formData.unitPrice),
      totalPrice: calculatedTotal,
      baseSize: base,
      isActive: crud.formData.isActive,
      features: cleanFeatures(crud.formData.features),
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

  const handleArrayChange = (arrayName, index) => (e) => {
    const value = e?.target ? e.target.value : e;
    crud.setFormData((prev) => {
      const newArray = [...(prev[arrayName] || [])];
      newArray[index] = value;
      return { ...prev, [arrayName]: newArray };
    });
  };

  const addArrayItem =
    (arrayName, defaultValue = "") =>
    () => {
      crud.setFormData((prev) => ({
        ...prev,
        [arrayName]: [...(prev[arrayName] || []), defaultValue],
      }));
    };

  const removeArrayItem = (arrayName, index) => () => {
    crud.setFormData((prev) => ({
      ...prev,
      [arrayName]: (prev[arrayName] || []).filter((_, i) => i !== index),
    }));
  };

  // ------------------------------- Return ------------------------------------
  return {
    ...crud,
    bundles,
    totalItems,
    totalPages,
    calculatedTotal,
    columns,
    isLoadingBundles,
    isSubmitting,
    isDeleting,
    handleEdit,
    handleSubmit,
    handleChange,
    handleValueChange,
    handleArrayChange,
    addArrayItem,
    removeArrayItem,
  };
};

export default useDealerBundleManagement;
