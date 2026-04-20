import { useState, useCallback, useMemo, useEffect } from "react";
import {
  useGetOrdersQuery,
  useUpdateOrderStatusMutation,
} from "@/redux/api/adminApi";
import { useGetOrderConfigQuery } from "@/redux/api/authApi";
import {
  extractPaginatedData,
  handleApiError,
  handleApiSuccess,
} from "@/utils/apiHelpers";
import { buildAdminStatusOptions } from "@/constant/orderData";
import useAdminCrud from "@/hooks/admin/useAdminCrud";
import { sanitizeString, sanitizeOptional } from "@/utils/formatting";
import { validateOrderStatusUpdate } from "@/utils/validation";

const columns = [
  { key: "invoice", label: "Invoice Number" },
  { key: "customer", label: "Customer" },
  { key: "email", label: "Email" },
  { key: "orderType", label: "Type" },
  { key: "totalAmount", label: "Total" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created At" },
  { key: "actions", label: "Actions" },
];

const useOrderManagement = () => {
  // ------------------------------- Core CRUD ------------------------------------
  const crud = useAdminCrud({
    initialFormData: {},
    createFn: null,
    updateFn: null,
    deleteFn: null,
    entityName: "order",
  });

  // ------------------------------- Modal States ------------------------------------
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [newStatus, setNewStatus] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingLink, setTrackingLink] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState(null);

  const resetStatusFields = useCallback(() => {
    setNewStatus("");
    setCarrier("");
    setTrackingNumber("");
    setTrackingLink("");
    setCancelReason("");
    setCancelNotes("");
  }, []);

  // ------------------------------- Mutations ------------------------------------
  const [updateOrderStatus, { isLoading: isUpdatingStatus }] =
    useUpdateOrderStatusMutation();

  // ------------------------------- Fetch ------------------------------------
  const { data: ordersData, isLoading: isLoadingOrders } = useGetOrdersQuery({
    page: crud.page,
    limit: crud.limit,
    search: crud.search || undefined,
  });

  const { data: configData, isLoading: isLoadingConfig } =
    useGetOrderConfigQuery();

  const adminStatusOptions = useMemo(
    () => buildAdminStatusOptions(configData?.validTransitions),
    [configData?.validTransitions],
  );

  const {
    items: orders,
    totalItems,
    totalPages,
  } = extractPaginatedData(ordersData, "orders");

  useEffect(() => {
    crud.setTotalItems(totalItems);
  }, [totalItems]);

  // ------------------------------- Derived ------------------------------------
  const orderReference = useMemo(() => {
    if (!selectedOrder) return "";
    return (
      selectedOrder.payment?.stripeInvoiceNumber ||
      selectedOrder._id?.substring(0, 7) ||
      ""
    );
  }, [selectedOrder]);

  // ------------------------------- Modal Handlers ------------------------------------
  const handleStatusModalChange = useCallback(
    (open) => {
      setStatusModalOpen(open);
      if (!open) {
        setSelectedOrder(null);
        resetStatusFields();
      }
    },
    [resetStatusFields],
  );

  const handleEdit = useCallback(
    (order) => {
      resetStatusFields();
      setSelectedOrder(order);
      setStatusModalOpen(true);
    },
    [resetStatusFields],
  );

  const closeStatusModal = useCallback(() => {
    handleStatusModalChange(false);
  }, [handleStatusModalChange]);

  const handleViewModalChange = useCallback((open) => {
    setViewModalOpen(open);
    if (!open) setViewOrder(null);
  }, []);

  const handleView = useCallback((order) => {
    setViewOrder(order);
    setViewModalOpen(true);
  }, []);

  // ------------------------------- Status Update ------------------------------------
  const handleUpdateStatus = useCallback(async () => {
    if (
      !validateOrderStatusUpdate({
        selectedOrder,
        newStatus,
        carrier,
        trackingNumber,
        trackingLink,
        cancelReason,
      })
    )
      return;

    try {
      const result = await updateOrderStatus({
        id: selectedOrder._id,
        status: newStatus,
        ...(sanitizeOptional(carrier) && {
          carrier: sanitizeString(carrier),
        }),
        ...(sanitizeOptional(trackingNumber) && {
          trackingNumber: sanitizeString(trackingNumber),
        }),
        ...(sanitizeOptional(trackingLink) && {
          trackingLink: sanitizeString(trackingLink),
        }),
        ...(sanitizeOptional(cancelReason) && {
          reason: sanitizeString(cancelReason),
        }),
        ...(sanitizeOptional(cancelNotes) && {
          notes: sanitizeString(cancelNotes),
        }),
      }).unwrap();

      handleApiSuccess(result, "Order status updated");
      closeStatusModal();
    } catch (error) {
      handleApiError(error, "Failed to update order status");
    }
  }, [
    selectedOrder,
    newStatus,
    carrier,
    trackingNumber,
    trackingLink,
    cancelReason,
    cancelNotes,
    updateOrderStatus,
    closeStatusModal,
  ]);

  const handleStatusFormSubmit = useCallback(
    (event) => {
      event?.preventDefault?.();
      handleUpdateStatus();
    },
    [handleUpdateStatus],
  );

  const getAvailableTransitions = useCallback(
    (orderStatus) => adminStatusOptions[orderStatus] || [],
    [adminStatusOptions],
  );

  // ------------------------------- Return ------------------------------------
  return {
    ...crud,
    orders,
    totalItems,
    totalPages,
    columns,
    isLoadingOrders,
    statusModalOpen,
    selectedOrder,
    newStatus,
    carrier,
    trackingNumber,
    trackingLink,
    cancelReason,
    cancelNotes,
    isUpdatingStatus,
    viewModalOpen,
    viewOrder,
    orderReference,
    setNewStatus,
    setCarrier,
    setTrackingNumber,
    setTrackingLink,
    setCancelReason,
    setCancelNotes,
    handleEdit,
    handleView,
    handleStatusModalChange,
    handleViewModalChange,
    handleUpdateStatus,
    getAvailableTransitions,
    isLoadingConfig,
    handleStatusFormSubmit,
  };
};

export default useOrderManagement;
