import { useState, useCallback, useEffect, useMemo } from "react";
import { handleApiError, handleApiSuccess } from "@/utils/apiHelpers";

const useAdminCrud = ({
  initialFormData,
  createFn,
  updateFn,
  deleteFn,
  entityName = "item",
  onReset,
  totalItems: externalTotalItems = 0,
}) => {
  // ------------------------------- Table State ------------------------------------
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState("50");
  const [search, setSearch] = useState("");
  const [totalItems, setTotalItems] = useState(externalTotalItems);

  useEffect(() => {
    setTotalItems(externalTotalItems);
  }, [externalTotalItems]);

  const entriesPerPage = parseInt(limit, 10) || 50;

  const totalPages = Math.ceil(totalItems / entriesPerPage);
  const startItem = totalItems === 0 ? 0 : (page - 1) * entriesPerPage + 1;
  const endItem = Math.min(page * entriesPerPage, totalItems);

  const handlePageChange = useCallback((newPage) => setPage(newPage), []);
  const handleLimitChange = useCallback((value) => {
    setLimit(value);
    setPage(1);
  }, []);
  const handleSearchChange = useCallback((value) => {
    const finalValue = value?.target ? value.target.value : value;
    setSearch(finalValue || "");
    setPage(1);
  }, []);

  const handlePrevious = useCallback(() => {
    if (page > 1) setPage(page - 1);
  }, [page]);

  const handleNext = useCallback(() => {
    if (page < totalPages) setPage(page + 1);
  }, [page, totalPages]);

  // ------------------------------- Dialog & Form State ------------------------------------
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("add");
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const isEditMode = dialogMode === "edit";

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setSelectedItem(null);
    setDialogMode("add");
    onReset?.();
  }, [initialFormData, onReset]);

  const handleDialogClose = useCallback(
    (open) => {
      setDialogOpen(open);
      if (!open) resetForm();
    },
    [resetForm],
  );

  const handleAdd = useCallback(
    (overrides) => {
      resetForm();
      if (overrides) {
        setFormData((prev) => ({ ...prev, ...overrides }));
      }
      setDialogOpen(true);
    },
    [resetForm],
  );

  const openEdit = useCallback((item, mappedFormData) => {
    setDialogMode("edit");
    setSelectedItem(item);
    setFormData(mappedFormData);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback((item) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  }, []);

  // ------------------------------- Submit Logic ------------------------------------
  const submitForm = useCallback(
    async (payload) => {
      try {
        if (dialogMode === "add") {
          const response = await createFn(payload).unwrap();
          if (response.success) {
            handleApiSuccess(response, `${entityName} created successfully`);
            handleDialogClose(false);
          }
          return response;
        } else {
          const id = selectedItem?._id || selectedItem?.id;
          const response = await updateFn({ id, ...payload }).unwrap();
          if (response.success) {
            handleApiSuccess(response, `${entityName} updated successfully`);
            handleDialogClose(false);
          }
          return response;
        }
      } catch (error) {
        handleApiError(error, `Failed to save ${entityName}`);
        throw error;
      }
    },
    [
      dialogMode,
      selectedItem,
      createFn,
      updateFn,
      entityName,
      handleDialogClose,
    ],
  );

  // ------------------------------- Delete Logic ------------------------------------
  const handleConfirmDelete = useCallback(async () => {
    if (!selectedItem) return;

    try {
      const id = selectedItem._id || selectedItem.id;
      const response = await deleteFn(id).unwrap();

      if (response.success) {
        handleApiSuccess(response, `${entityName} deleted successfully`);
        setDeleteDialogOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      handleApiError(error, `Failed to delete ${entityName}`);
    }
  }, [selectedItem, deleteFn, entityName]);

  return {
    // Table State
    page,
    limit,
    search,
    totalItems,
    totalPages,
    startItem,
    endItem,
    setTotalItems,

    // Table Handlers
    handlePageChange,
    handleLimitChange,
    handleSearchChange,
    handlePrevious,
    handleNext,

    // Dialog State
    dialogOpen,
    deleteDialogOpen,
    dialogMode,
    isEditMode,
    selectedItem,
    formData,
    setFormData,
    setDeleteDialogOpen,

    // Dialog Handlers
    handleDialogClose,
    handleAdd,
    openEdit,
    handleDelete,

    // CRUD
    submitForm,
    handleConfirmDelete,
  };
};

export default useAdminCrud;
