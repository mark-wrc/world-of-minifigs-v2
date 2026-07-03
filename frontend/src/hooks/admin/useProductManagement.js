import { useState, useMemo, useCallback, useEffect } from "react";
import {
  useGetProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useGetCategoriesQuery,
  useGetSubCategoriesQuery,
  useGetCollectionsQuery,
  useGetSubCollectionsQuery,
  useGetColorsQuery,
  useGetSkillLevelsQuery,
} from "@/redux/api/adminApi";
import { toast } from "sonner";
import { extractPaginatedData } from "@/utils/apiHelpers";
import { sanitizeString, sortByName } from "@/utils/formatting";
import { validateProduct, handleFileReadError } from "@/utils/validation";
import useMediaPreview from "@/hooks/admin/useMediaPreview";
import { validateFile, readFileAsDataURL } from "@/utils/fileHelpers";
import { uploadImagesToCloudinary } from "@/utils/cloudinaryUpload";
import useAdminCrud from "@/hooks/admin/useAdminCrud";

/* -------------------------------------------------------------------------- */
/*                                Initial Data                                */
/* -------------------------------------------------------------------------- */

const initialFormData = {
  productName: "",
  partId: "",
  itemId: "",
  price: "",
  discount: "",
  descriptions: [""],
  images: [],
  categoryIds: [],
  subCategoryIds: [],
  collectionIds: [],
  subCollectionIds: [],
  pieceCount: "",
  length: "",
  width: "",
  height: "",
  colorId: "",
  secondaryColorId: "",
  showSecondaryColor: false,
  skillLevelIds: [],
  stock: "",
  isActive: true,
};

const defaultVariant = {
  colorId: "",
  secondaryColorId: "",
  showSecondaryColor: false,
  itemId: "",
  stock: "",
  image: "",
  imagePreview: "",
};

const columns = [
  { key: "productName", label: "Product Name" },
  { key: "productType", label: "Type" },
  { key: "price", label: "Price" },
  { key: "discount", label: "Discount" },
  { key: "discountPrice", label: "Discount Price" },
  { key: "isActive", label: "Status" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" },
  { key: "actions", label: "Actions" },
];

const useProductManagement = () => {
  const [productType, setProductType] = useState("standalone");
  const [variants, setVariants] = useState([{ ...defaultVariant }]);
  const [imagesChanged, setImagesChanged] = useState(false);

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
    fileInputRef,
    resetFile,
    handleFileChange,
    handleRemoveFile,
  } = useMediaPreview({ multiple: true, maxFiles: 10 });

  const resetProductState = useCallback(() => {
    setProductType("standalone");
    setVariants([{ ...defaultVariant }]);
    resetFile();
    setImagesChanged(false);
  }, [resetFile]);

  // ------------------------------- Mutations ------------------------------------
  const [createProduct, { isLoading: isCreating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation();
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation();

  // ------------------------------- Core CRUD ------------------------------------
  const crud = useAdminCrud({
    initialFormData,
    createFn: createProduct,
    updateFn: updateProduct,
    deleteFn: deleteProduct,
    entityName: "product",
    onReset: resetProductState,
  });

  // ------------------------------- Fetch ------------------------------------
  const { data: productsData, isLoading: isLoadingProducts } =
    useGetProductsQuery({
      page: crud.page,
      limit: crud.limit,
      search: crud.search || undefined,
    });

  const { data: categoriesData, isLoading: isLoadingCategories } =
    useGetCategoriesQuery();
  const { data: subCategoriesData, isLoading: isLoadingSubCategories } =
    useGetSubCategoriesQuery();
  const { data: collectionsData, isLoading: isLoadingCollections } =
    useGetCollectionsQuery();
  const { data: subCollectionsData, isLoading: isLoadingSubCollections } =
    useGetSubCollectionsQuery();
  const { data: colorsData, isLoading: isLoadingColors } = useGetColorsQuery();
  const { data: skillLevelsData, isLoading: isLoadingSkillLevels } =
    useGetSkillLevelsQuery();

  const {
    items: products,
    totalItems,
    totalPages,
  } = extractPaginatedData(productsData, "products");

  const categories = useMemo(
    () => sortByName(categoriesData?.categories, "categoryName"),
    [categoriesData],
  );

  const subCategories = useMemo(
    () => sortByName(subCategoriesData?.subCategories, "subCategoryName"),
    [subCategoriesData],
  );

  const collections = useMemo(
    () => sortByName(collectionsData?.collections, "collectionName"),
    [collectionsData],
  );

  const subCollections = useMemo(
    () => sortByName(subCollectionsData?.subCollections, "subCollectionName"),
    [subCollectionsData],
  );

  const skillLevels = useMemo(
    () => sortByName(skillLevelsData?.skillLevels, "skillLevelName"),
    [skillLevelsData],
  );

  const colors = useMemo(
    () => sortByName(colorsData?.colors, "colorName"),
    [colorsData],
  );

  useEffect(() => {
    crud.setTotalItems(totalItems);
  }, [totalItems]);

  const categoriesWithSubs = useMemo(() => {
    return categories.map((category) => {
      const categoryId = category._id || category.id;
      const subs = subCategories.filter(
        (sub) => (sub.categoryId?._id || sub.categoryId) === categoryId,
      );
      return { ...category, subCategories: subs };
    });
  }, [categories, subCategories]);

  const collectionsWithSubs = useMemo(() => {
    return collections.map((collection) => {
      const collectionId = collection._id || collection.id;
      const subs = subCollections.filter(
        (sub) => (sub.collectionId?._id || sub.collectionId) === collectionId,
      );
      return { ...collection, subCollections: subs };
    });
  }, [collections, subCollections]);

  const isSubmitting =
    uploadProgress.isUploading || (crud.isEditMode ? isUpdating : isCreating);

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

  const handleMultiSelectChange = (name) => (value) => {
    crud.setFormData((prev) => {
      const current = prev[name] || [];
      const exists = current.includes(value);
      return {
        ...prev,
        [name]: exists
          ? current.filter((id) => id !== value)
          : [...current, value],
      };
    });
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

  const handleImageChange = async (e) => {
    // Keep the raw File on each entry; it uploads directly to Cloudinary at
    // submit. `url` is a preview-only data-URL.
    const items = await handleFileChange(e, {
      mapFile: (url, file) => ({ url, file }),
    });
    if (items?.length) {
      crud.setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...items],
      }));
      setImagesChanged(true);
    }
  };

  const handleRemoveImage = useCallback(
    (index) => {
      handleRemoveFile(index);
      crud.setFormData((prev) => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index),
      }));
      setImagesChanged(true);
    },
    [handleRemoveFile, crud.setFormData],
  );

  const handleAddVariant = () => {
    setVariants((prev) => [...prev, { ...defaultVariant }]);
  };

  const handleRemoveVariant = useCallback(
    (index) => {
      if (variants.length > 1) {
        setVariants((prev) => prev.filter((_, i) => i !== index));
      }
    },
    [variants.length],
  );

  const handleVariantChange = (index, field) => (e) => {
    const value = e?.target ? e.target.value : e;
    setVariants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleVariantImageChange = (variantIndex) => async (e) => {
    const file = e.target.files?.[0];
    if (!file || !validateFile(file)) return;

    try {
      const dataUrl = await readFileAsDataURL(file);
      setVariants((prev) => {
        const copy = [...prev];
        copy[variantIndex] = {
          ...copy[variantIndex],
          imagePreview: dataUrl,
          image: dataUrl,
          // Raw File for direct Cloudinary upload at submit.
          imageFile: file,
        };
        return copy;
      });
    } catch {
      handleFileReadError();
    }
  };

  const handleRemoveVariantImage = useCallback((variantIndex) => {
    setVariants((prev) => {
      const copy = [...prev];
      copy[variantIndex] = {
        ...copy[variantIndex],
        imagePreview: "",
        image: "",
        imageFile: null,
      };
      return copy;
    });
  }, []);

  // ------------------------------- Edit Handler ------------------------------------

  const handleEdit = (product) => {
    const existingDescriptions = product.descriptions?.filter(Boolean) || [""];

    const hasSecondaryColor = !!(
      product.secondaryColorId?._id || product.secondaryColorId
    );

    const mappedForm = {
      ...initialFormData,
      productName: product.productName || "",
      partId: product.partId || "",
      itemId: product.itemId || "",
      price: product.price || "",
      discount: product.discount || "",
      descriptions: existingDescriptions,
      categoryIds: product.categoryIds?.map((c) => c._id || c) || [],
      subCategoryIds: product.subCategoryIds?.map((c) => c._id || c) || [],
      collectionIds: product.collectionIds?.map((c) => c._id || c) || [],
      subCollectionIds: product.subCollectionIds?.map((c) => c._id || c) || [],
      pieceCount: product.pieceCount || "",
      length: product.length || "",
      width: product.width || "",
      height: product.height || "",
      colorId: product.colorId?._id || product.colorId || "",
      secondaryColorId:
        product.secondaryColorId?._id || product.secondaryColorId || "",
      showSecondaryColor: hasSecondaryColor,
      skillLevelIds: product.skillLevelIds?.map((sl) => sl._id || sl) || [],
      stock: product.stock || "",
      isActive: product.isActive !== undefined ? product.isActive : true,
    };

    crud.openEdit(product, mappedForm);

    const existingImages =
      product.images?.map((img) => ({ url: img.url })) || [];
    setFilePreview(existingImages);

    const existingImageObjects =
      product.images?.map((img) => ({
        publicId: img.publicId,
        url: img.url,
      })) || [];

    crud.setFormData((prev) => ({
      ...prev,
      images: existingImageObjects,
    }));

    setImagesChanged(false);

    if (product.variants?.length) {
      setProductType("variant");
      setVariants(
        product.variants.map((variant) => ({
          colorId: variant.colorId?._id || variant.colorId || "",
          secondaryColorId:
            variant.secondaryColorId?._id || variant.secondaryColorId || "",
          showSecondaryColor: !!(
            variant.secondaryColorId?._id || variant.secondaryColorId
          ),
          itemId: variant.itemId || "",
          stock: variant.stock || "",
          image: variant.image
            ? { publicId: variant.image.publicId, url: variant.image.url }
            : "",
          imagePreview: variant.image?.url || "",
        })),
      );
    } else {
      setProductType("standalone");
      setVariants([{ ...defaultVariant }]);
    }
  };

  // ------------------------------- Submit Handler ------------------------------------

  const handleSubmit = async () => {
    if (!validateProduct(crud.formData, productType, variants, filePreview))
      return;

    const validDescriptions = crud.formData.descriptions
      .map((d) => sanitizeString(d))
      .filter(Boolean);

    const productData = {
      productName: sanitizeString(crud.formData.productName),
      price: Number(crud.formData.price),
      descriptions: validDescriptions.slice(0, 3),
      isActive: crud.formData.isActive,
    };

    try {
      if (productType === "standalone") {
        // Upload newly-added images (those carrying a raw File) directly.
        const imgs = crud.formData.images;
        const pending = imgs
          .map((im, i) => ({ im, i }))
          .filter(({ im }) => !im?.publicId && im?.file);

        let refs = [];
        if (pending.length > 0) {
          setUploadProgress({ isUploading: true, done: 0, total: pending.length });
          refs = await uploadImagesToCloudinary(
            pending.map(({ im }) => im.file),
            "product",
            {
              onProgress: (done, total) =>
                setUploadProgress({ isUploading: true, done, total }),
            },
          );
          setUploadProgress({ isUploading: false, done: 0, total: 0 });
        }
        const refByIndex = new Map();
        pending.forEach(({ i }, k) => refByIndex.set(i, refs[k]));

        productData.productType = "standalone";
        productData.partId = sanitizeString(crud.formData.partId);
        productData.itemId = sanitizeString(crud.formData.itemId);
        productData.images = imgs
          .map((im, i) =>
            im?.publicId ? { publicId: im.publicId, url: im.url } : refByIndex.get(i),
          )
          .filter(Boolean);

        if (crud.formData.colorId) productData.colorId = crud.formData.colorId;

        if (crud.formData.secondaryColorId)
          productData.secondaryColorId = crud.formData.secondaryColorId;

        if (crud.formData.stock !== "")
          productData.stock = Number(crud.formData.stock) || 0;
      }

      if (productType === "variant") {
        // Upload newly-added variant images (those carrying a raw File) directly.
        const pending = variants
          .map((v, i) => ({ v, i }))
          .filter(({ v }) => !(v?.image && v.image.publicId) && v?.imageFile);

        let refs = [];
        if (pending.length > 0) {
          setUploadProgress({ isUploading: true, done: 0, total: pending.length });
          refs = await uploadImagesToCloudinary(
            pending.map(({ v }) => v.imageFile),
            "product-variant",
            {
              onProgress: (done, total) =>
                setUploadProgress({ isUploading: true, done, total }),
            },
          );
          setUploadProgress({ isUploading: false, done: 0, total: 0 });
        }
        const refByIndex = new Map();
        pending.forEach(({ i }, k) => refByIndex.set(i, refs[k]));

        productData.productType = "variant";
        productData.partId = sanitizeString(crud.formData.partId);
        productData.variants = variants.map((variant, i) => ({
          colorId: variant.colorId,
          ...(variant.secondaryColorId && {
            secondaryColorId: variant.secondaryColorId,
          }),
          itemId: sanitizeString(variant.itemId),
          stock: Number(variant.stock) || 0,
          image:
            variant.image && variant.image.publicId
              ? { publicId: variant.image.publicId, url: variant.image.url }
              : refByIndex.get(i) || null,
        }));
      }
    } catch (error) {
      setUploadProgress({ isUploading: false, done: 0, total: 0 });
      toast.error("Image upload failed", {
        description: error?.message || "Could not upload images.",
      });
      return;
    }

    if (crud.formData.discount !== "")
      productData.discount = Number(crud.formData.discount);

    if (crud.formData.categoryIds?.length)
      productData.categoryIds = crud.formData.categoryIds;

    if (crud.formData.subCategoryIds?.length)
      productData.subCategoryIds = crud.formData.subCategoryIds;

    if (crud.formData.collectionIds?.length)
      productData.collectionIds = crud.formData.collectionIds;

    if (crud.formData.subCollectionIds?.length)
      productData.subCollectionIds = crud.formData.subCollectionIds;

    if (crud.formData.pieceCount !== "")
      productData.pieceCount = Number(crud.formData.pieceCount);

    if (crud.formData.length !== "")
      productData.length = Number(crud.formData.length);

    if (crud.formData.width !== "")
      productData.width = Number(crud.formData.width);

    if (crud.formData.height !== "")
      productData.height = Number(crud.formData.height);

    if (crud.formData.skillLevelIds?.length)
      productData.skillLevelIds = crud.formData.skillLevelIds;

    await crud.submitForm(productData);
  };

  // ------------------------------- Return ------------------------------------
  return {
    ...crud,
    productType,
    variants,
    filePreview,
    imagesChanged,
    products,
    totalItems,
    totalPages,
    columns,
    categories,
    subCategories,
    collections,
    subCollections,
    colors,
    skillLevels,
    categoriesWithSubs,
    collectionsWithSubs,
    isLoadingProducts,
    isLoadingCategories,
    isLoadingSubCategories,
    isLoadingCollections,
    isLoadingSubCollections,
    isLoadingColors,
    isLoadingSkillLevels,
    isSubmitting,
    uploadProgress,
    isDeleting,
    handleEdit,
    handleSubmit,
    handleChange,
    handleValueChange,
    handleMultiSelectChange,
    handleArrayChange,
    addArrayItem,
    removeArrayItem,
    handleImageChange,
    handleRemoveImage,
    handleAddVariant,
    handleRemoveVariant,
    handleVariantChange,
    handleVariantImageChange,
    handleRemoveVariantImage,

    setProductType,
    setFilePreview,
    fileInputRef,
  };
};

export default useProductManagement;
