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
import {
  buildAdminStatusOptions,
  buildDeliveryMethodOptions,
  getInvoiceNumber,
} from "@/constant/orderData";
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

  // ------------------------------- Status Filter ------------------------------------
  const [statusFilter, setStatusFilter] = useState("");

  const handleStatusFilterChange = useCallback((value) => {
    setStatusFilter(value === "all" ? "" : value);
  }, []);

  useEffect(() => {
    crud.handlePageChange(1);
  }, [statusFilter]);

  // ------------------------------- Modal States ------------------------------------
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  // Limits the dialog's status options — e.g. only "shipped" from a shipment
  // row, only "cancelled" for an order inside a paid shipment. null = all.
  const [allowedStatuses, setAllowedStatuses] = useState(null);

  const [newStatus, setNewStatus] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingLink, setTrackingLink] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState(null);

  // A consolidated shipment opened in its own view: { shipment, orders }.
  const [viewShipment, setViewShipment] = useState(null);

  const resetStatusFields = useCallback(() => {
    setNewStatus("");
    setCarrier("");
    setTrackingNumber("");
    setTrackingLink("");
    setCancelReason("");
    setCancelNotes("");
    setDeliveryMethod("");
    setReceivedBy("");
    setDeliveryNotes("");
  }, []);

  // ------------------------------- Mutations ------------------------------------
  const [updateOrderStatus, { isLoading: isUpdatingStatus }] =
    useUpdateOrderStatusMutation();

  // ------------------------------- Fetch ------------------------------------
  const { data: ordersData, isLoading: isLoadingOrders } = useGetOrdersQuery({
    page: crud.page,
    limit: crud.limit,
    search: crud.search || undefined,
    status: statusFilter || undefined,
  });

  const { data: configData, isLoading: isLoadingConfig } =
    useGetOrderConfigQuery();

  const adminStatusOptions = useMemo(
    () => buildAdminStatusOptions(configData?.validTransitions),
    [configData?.validTransitions],
  );

  const deliveryMethodOptions = useMemo(
    () => buildDeliveryMethodOptions(configData?.deliveryMethods),
    [configData?.deliveryMethods],
  );

  // Rows: a consolidated shipment (with its orders) or a single order.
  const {
    items: orderGroups,
    totalItems,
    totalPages,
  } = extractPaginatedData(ordersData, "groups");

  // Which shipment rows are expanded to show their orders.
  const [expandedShipments, setExpandedShipments] = useState({});
  const toggleShipment = useCallback(
    (id) => setExpandedShipments((prev) => ({ ...prev, [id]: !prev[id] })),
    [],
  );

  useEffect(() => {
    crud.setTotalItems(totalItems);
  }, [totalItems]);

  // ------------------------------- Derived ------------------------------------
  const orderReference = useMemo(() => {
    if (!selectedOrder) return "";
    return (
      getInvoiceNumber(selectedOrder) ||
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
        setAllowedStatuses(null);
        resetStatusFields();
      }
    },
    [resetStatusFields],
  );

  // `presetStatus` pre-selects a status ("Mark as shipped" on a shipment
  // row); `allowed` limits which statuses the dialog offers.
  const handleEdit = useCallback(
    (order, { presetStatus, allowed } = {}) => {
      resetStatusFields();
      setSelectedOrder(order);
      setAllowedStatuses(allowed || null);
      if (presetStatus) setNewStatus(presetStatus);
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

  const handleViewShipment = useCallback(
    (group) => setViewShipment(group),
    [],
  );
  const handleViewShipmentChange = useCallback((open) => {
    if (!open) setViewShipment(null);
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
        deliveryMethod,
      })
    )
      return;

    // Cancellation and delivery each carry their own notes, but only one branch
    // ever runs — the backend reads a single "notes" field for both.
    const notes = newStatus === "delivered" ? deliveryNotes : cancelNotes;

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
        ...(sanitizeOptional(notes) && {
          notes: sanitizeString(notes),
        }),
        ...(deliveryMethod && { deliveryMethod }),
        ...(sanitizeOptional(receivedBy) && {
          receivedBy: sanitizeString(receivedBy),
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
    deliveryMethod,
    receivedBy,
    deliveryNotes,
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
    (orderStatus, allowed) => {
      const options = adminStatusOptions[orderStatus] || [];
      return allowed
        ? options.filter((option) => allowed.includes(option.value))
        : options;
    },
    [adminStatusOptions],
  );

  // ------------------------------- Return ------------------------------------
  return {
    ...crud,
    orderGroups,
    expandedShipments,
    toggleShipment,
    totalItems,
    totalPages,
    columns,
    isLoadingOrders,
    statusModalOpen,
    selectedOrder,
    allowedStatuses,
    newStatus,
    carrier,
    trackingNumber,
    trackingLink,
    cancelReason,
    cancelNotes,
    deliveryMethod,
    receivedBy,
    deliveryNotes,
    deliveryMethodOptions,
    isUpdatingStatus,
    viewModalOpen,
    viewOrder,
    viewShipment,
    handleViewShipment,
    handleViewShipmentChange,
    orderReference,
    setNewStatus,
    setCarrier,
    setTrackingNumber,
    setTrackingLink,
    setCancelReason,
    setCancelNotes,
    setDeliveryMethod,
    setReceivedBy,
    setDeliveryNotes,
    statusFilter,
    handleStatusFilterChange,
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
