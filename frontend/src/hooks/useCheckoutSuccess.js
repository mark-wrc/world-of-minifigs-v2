import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useConfirmOrderQuery } from "@/redux/api/paymentApi";
import {
  authApi,
  useGetUserOrderByIdQuery,
  useGetOrderConfigQuery,
  useCancelOrderMutation,
} from "@/redux/api/authApi";
import { publicApi } from "@/redux/api/publicApi";
import { clearCartLocal } from "@/redux/slices/cartSlice";
import { handleApiError, handleApiSuccess } from "@/utils/apiHelpers";
import { getOrderStatusConfig, getDisplayItems } from "@/constant/orderData";

const useCheckoutSuccess = () => {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sessionId = searchParams.get("session_id");
  const orderId = searchParams.get("order_id");
  const [copied, setCopied] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");

  // Data fetching hooks
  const {
    data: sessionData,
    isLoading: isSessionLoading,
    isError: isSessionError,
  } = useConfirmOrderQuery(sessionId ?? "", { skip: !sessionId });

  const {
    data: orderData,
    isLoading: isOrderLoading,
    isError: isOrderError,
  } = useGetUserOrderByIdQuery(orderId, { skip: !orderId || !!sessionId });

  const { data: configData } = useGetOrderConfigQuery();
  const [cancelOrder, { isLoading: isCancelling }] = useCancelOrderMutation();

  const cancellationReasons = configData?.cancellationReasons || [];

  const data = sessionId ? sessionData : orderData;
  const isLoading = sessionId ? isSessionLoading : isOrderLoading;
  const isError = sessionId ? isSessionError : isOrderError;

  const order = data?.order;
  const displayItems = getDisplayItems(order);
  const invoiceLabel =
    order?.payment?.stripeInvoiceNumber || order?._id?.substring(0, 7);
  const invoiceValue = order?.payment?.stripeInvoiceNumber || order?._id;

  const status = order?.status || "paid";
  const statusConfig = getOrderStatusConfig(order);
  const canCancel = status === "paid";

  const isCancelValid =
    cancelReason &&
    cancellationReasons.includes(cancelReason) &&
    (cancelReason !== "Other" || cancelNotes.trim());

  useEffect(() => {
    if (!sessionId && !orderId) {
      navigate("/", { replace: true });
    }
  }, [sessionId, orderId, navigate]);

  // Clear cart and invalidate caches on successful checkout (session flow only)
  useEffect(() => {
    if (sessionId && data?.success && data?.order) {
      dispatch(authApi.util.invalidateTags(["Cart", "Order"]));
      dispatch(clearCartLocal());

      const order = data.order;
      const tags = [];

      // Standards Products
      if (order.productItems) {
        order.productItems.forEach((item) => {
          tags.push({
            type: "Product",
            id: item.productId?.toString?.() ?? item.productId,
          });
        });
      }

      // Dealer Addons
      if (order.dealerItems?.addons) {
        order.dealerItems.addons.forEach((addon) => {
          addon.subItems?.forEach((sub) => {
            tags.push({
              type: "GeneralInventory",
              id: sub.invId?.toString?.() ?? sub.invId,
            });
          });
        });
      }

      if (tags.length > 0) {
        dispatch(publicApi.util.invalidateTags([...tags, "Product"]));
      }
    }
  }, [sessionId, data, dispatch]);

  // ==================== Handlers ====================

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const onCancelModalChange = useCallback((open) => {
    setCancelModalOpen(open);
    if (!open) {
      setCancelReason("");
      setCancelNotes("");
    }
  }, []);

  const handleCancelOrder = useCallback(async () => {
    if (!order?._id || !cancelReason) return;
    if (cancelReason === "Other" && !cancelNotes.trim()) return;

    try {
      const result = await cancelOrder({
        id: order._id,
        reason: cancelReason,
        notes: cancelNotes.trim() || undefined,
      }).unwrap();

      handleApiSuccess(result, "Order cancelled");
      onCancelModalChange(false);
      navigate(`/checkout/success?order_id=${order._id}`, { replace: true });
    } catch (error) {
      handleApiError(error, "Failed to cancel order");
    }
  }, [
    order?._id,
    cancelReason,
    cancelNotes,
    cancelOrder,
    onCancelModalChange,
    navigate,
  ]);

  return {
    // Data
    sessionId,
    orderId,
    order,
    displayItems,
    invoiceLabel,
    invoiceValue,
    status,
    statusConfig,
    canCancel,
    cancellationReasons,

    // State & Setters
    copied,
    cancelModalOpen,
    cancelReason,
    cancelNotes,
    setCancelReason,
    setCancelNotes,

    // Handlers
    copyToClipboard,
    onCancelModalChange,
    handleCancelOrder,

    // Status
    isLoading,
    isError,
    isCancelling,
    isCancelValid,
  };
};

export default useCheckoutSuccess;
