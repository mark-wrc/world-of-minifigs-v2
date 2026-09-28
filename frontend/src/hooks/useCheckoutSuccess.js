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
import { clearDealerDraft } from "@/utils/dealerDraft";
import {
  getOrderStatusConfig,
  getDisplayItems,
  getInvoiceNumber,
  getInvoiceUrl,
} from "@/constant/orderData";

const useCheckoutSuccess = () => {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Returning from checkout: Stripe sends `session_id`, Square sends
  // `gateway=square&ref=<checkout reference>`.
  const sessionId = searchParams.get("session_id");
  const isSquareReturn = searchParams.get("gateway") === "square";
  const checkoutRef = sessionId || (isSquareReturn ? searchParams.get("ref") : null);
  const confirmArgs = {
    gateway: sessionId ? "stripe" : "square",
    ref: checkoutRef,
  };

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
  } = useConfirmOrderQuery(confirmArgs, { skip: !checkoutRef });

  const {
    data: orderData,
    isLoading: isOrderLoading,
    isError: isOrderError,
  } = useGetUserOrderByIdQuery(orderId, { skip: !orderId || !!checkoutRef });

  const { data: configData } = useGetOrderConfigQuery();
  const [cancelOrder, { isLoading: isCancelling }] = useCancelOrderMutation();

  const cancellationReasons = configData?.cancellationReasons || [];

  const data = checkoutRef ? sessionData : orderData;
  const isLoading = checkoutRef ? isSessionLoading : isOrderLoading;
  const isError = checkoutRef ? isSessionError : isOrderError;

  const order = data?.order;
  const displayItems = getDisplayItems(order);
  const invoiceLabel = getInvoiceNumber(order) || order?._id?.substring(0, 7);
  const invoiceValue = getInvoiceNumber(order) || order?._id;
  const invoiceUrl = getInvoiceUrl(order);

  const status = order?.status || "paid";
  const statusConfig = getOrderStatusConfig(order);
  const canCancel = status === "paid";

  const isCancelValid =
    cancelReason &&
    cancellationReasons.includes(cancelReason) &&
    (cancelReason !== "Other" || cancelNotes.trim());

  useEffect(() => {
    if (!checkoutRef && !orderId) {
      navigate("/", { replace: true });
    }
  }, [checkoutRef, orderId, navigate]);

  // Clear cart and invalidate caches on successful checkout (checkout return only)
  useEffect(() => {
    if (checkoutRef && data?.success && data?.order) {
      dispatch(authApi.util.invalidateTags(["Cart", "Order"]));
      dispatch(clearCartLocal());

      const order = data.order;
      const tags = [];

      // Drop the persisted dealer/wholesale order draft now that it's paid.
      if (order.orderType === "dealer" || order.orderType === "wholesale") {
        clearDealerDraft(order.orderType);
      }

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
  }, [checkoutRef, data, dispatch]);

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
    checkoutRef,
    orderId,
    order,
    displayItems,
    invoiceLabel,
    invoiceValue,
    invoiceUrl,
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
