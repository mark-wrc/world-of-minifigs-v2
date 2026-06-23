import Order from "../models/order.model.js";
import {
  sendShippingNotificationEmail,
  sendOrderCancelledEmail,
} from "../services/orderEmailService.js";
import {
  normalizePagination,
  buildSearchQuery,
  paginateQuery,
  createPaginationResponse,
} from "../utils/pagination.js";
import {
  ORDER_STATUSES,
  REFUND_STATUSES,
  VALID_STATUS_TRANSITIONS,
  CANCELLATION_REASONS,
} from "../constants/orderConstants.js";
import {
  validateUserCancellationRequest,
  ensureOrderIsUserCancellable,
  acquireCancellationLock,
  releaseCancellationLock,
  createStripeRefundForOrder,
  applyCancellationMetadata,
  restockOrderItemsSafely,
  buildCancellationSuccessResponse,
  validateStatusTransition,
  syncRefundStatus,
} from "../services/orderService.js";

//------------------------------------------------ Helpers ------------------------------------------

const buildOrderSearchQuery = (search) => {
  if (!search) return {};

  return buildSearchQuery(search, [
    "email",
    "shipping.address.name",
    "status",
    "payment.stripeInvoiceNumber",
    "items.productName",
  ]);
};

//--------------------------------------------- Get Order Status, Reason, and Valid Status Flow ------------------------------------------

export const getOrderConfig = async (_req, res) => {
  try {
    return res.status(200).json({
      success: true,
      statuses: ORDER_STATUSES,
      refundStatuses: REFUND_STATUSES,
      cancellationReasons: CANCELLATION_REASONS,
      validTransitions: VALID_STATUS_TRANSITIONS,
    });
  } catch (error) {
    console.error("Get order config error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order configuration",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get User Orders ------------------------------------------

export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page, limit, search } = normalizePagination(req.query);
    const { status } = req.query;

    const query = { userId, ...buildOrderSearchQuery(search) };

    // Filter by status tab (supports comma-separated for "Cancelled" tab)
    if (status) {
      const statuses = status.split(",").map((s) => s.trim());
      query.status = { $in: statuses };
    }

    const result = await paginateQuery(Order, query, {
      page,
      limit,
      sort: { createdAt: -1 },
      select:
        "-payment.stripeSessionId -payment.stripePaymentIntentId -__v -cancellation.isLocked -cancellation.lockExpiresAt -cancellation.cancelledById -refund.arn",
    });

    return res.status(200).json(createPaginationResponse(result, "orders"));
  } catch (error) {
    console.error("Get user orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get User Order by ID ------------------------------------------

export const getUserOrderById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
        description: "Please provide a valid order ID.",
      });
    }

    const order = await Order.findOne({ _id: id, userId }).select(
      "-payment.stripeSessionId -__v -cancellation.isLocked -cancellation.lockExpiresAt -cancellation.cancelledById -refund.arn",
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
        description: "The requested order does not exist.",
      });
    }

    // Sync refund status from Stripe if still pending
    await syncRefundStatus(order);

    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Get user order by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Cancel Order ------------------------------------------

export const cancelOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { reason, notes } = req.body;

    const validationError = validateUserCancellationRequest(reason, notes);
    if (validationError) {
      return res.status(validationError.status).json(validationError.body);
    }

    // Find the order and validate ownership
    const order = await Order.findOne({ _id: id, userId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
        description: "The requested order does not exist.",
      });
    }

    const cancellableError = ensureOrderIsUserCancellable(order);
    if (cancellableError) {
      return res.status(cancellableError.status).json(cancellableError.body);
    }

    const lockError = await acquireCancellationLock(order);
    if (lockError) {
      return res.status(lockError.status).json(lockError.body);
    }

    // Initiate Stripe refund
    let stripeRefund;
    try {
      stripeRefund = await createStripeRefundForOrder(order);
    } catch (stripeErr) {
      await releaseCancellationLock(order);

      console.error(
        `Stripe refund failed for order ${order._id}:`,
        stripeErr.message,
      );
      return res.status(502).json({
        success: false,
        message: "Refund could not be processed",
        description:
          "We were unable to initiate your refund. Please try again or contact support.",
      });
    }

    // Refund initiated successfully — update order
    applyCancellationMetadata(order, {
      role: "user",
      cancelledById: userId,
      reason,
      notes,
      stripeRefundId: stripeRefund.id,
    });

    await restockOrderItemsSafely(order);

    await order.save();

    sendOrderCancelledEmail(order).catch(() => {});

    return res
      .status(200)
      .json(
        buildCancellationSuccessResponse(
          order,
          "Order cancelled successfully",
          "Your refund has been initiated, depending on your bank’s processing times, it may take 5–10 business days to post the credit to your account",
        ),
      );
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get All Orders (Admin) ------------------------------------------

export const getAllOrders = async (req, res) => {
  try {
    const { page, limit, search } = normalizePagination(req.query);
    const { status } = req.query;

    const query = buildOrderSearchQuery(search);
    if (status) {
      const statuses = status.split(",").map((s) => s.trim());
      query.status = { $in: statuses };
    }

    const result = await paginateQuery(Order, query, {
      page,
      limit,
      sort: { createdAt: -1 },
      select: "-payment.stripeSessionId -payment.stripePaymentIntentId -__v",
      populate: [
        {
          path: "userId",
          select: "firstName lastName",
        },
        {
          path: "cancellation.cancelledById",
          select: "firstName lastName",
        },
      ],
    });

    return res.status(200).json(createPaginationResponse(result, "orders"));
  } catch (error) {
    console.error("Get all orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get Single Order (Admin) ------------------------------------------

export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
        description: "Please provide a valid order ID.",
      });
    }

    const order = await Order.findById(id).populate([
      {
        path: "userId",
        select: "firstName lastName",
      },
      {
        path: "cancellation.cancelledById",
        select: "firstName lastName",
      },
    ]);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
        description: "The requested order does not exist.",
      });
    }

    // Sync refund status from Stripe if still pending
    await syncRefundStatus(order);

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Get order by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Update Order Status (Admin) ------------------------------------------

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, carrier, trackingNumber, trackingLink, reason, notes } =
      req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
        description: "Please provide the new order status.",
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
        description: "The requested order does not exist.",
      });
    }

    // Validate transition
    const transitionError = validateStatusTransition(order.status, status);
    if (transitionError) {
      return res.status(transitionError.status).json(transitionError.body);
    }

    // Cancelled — require reason, initiate refund + restock
    if (status === ORDER_STATUSES.CANCELLED) {
      if (!reason || !reason.trim()) {
        return res.status(400).json({
          success: false,
          message: "Cancellation reason is required",
          description: "Please provide a reason for cancelling this order.",
        });
      }

      const lockError = await acquireCancellationLock(order);
      if (lockError) {
        return res.status(lockError.status).json(lockError.body);
      }

      // Initiate Stripe refund
      let stripeRefund;
      try {
        stripeRefund = await createStripeRefundForOrder(order);
      } catch (stripeErr) {
        await releaseCancellationLock(order);

        console.error(
          `Stripe refund failed for order ${order._id}:`,
          stripeErr.message,
        );
        return res.status(502).json({
          success: false,
          message: "Refund could not be processed",
          description:
            "We were unable to initiate the refund. Please try again or contact support.",
        });
      }

      applyCancellationMetadata(order, {
        role: "admin",
        cancelledById: req.user._id,
        reason,
        notes,
        stripeRefundId: stripeRefund.id,
      });

      await restockOrderItemsSafely(order);

      await order.save();

      sendOrderCancelledEmail(order).catch(() => {});

      return res
        .status(200)
        .json(
          buildCancellationSuccessResponse(
            order,
            "Order cancelled successfully",
            "The order has been cancelled and refund initiated.",
          ),
        );
    }

    // Shipped — require carrier, tracking number, and tracking link
    if (status === ORDER_STATUSES.SHIPPED) {
      const missingFields = [];
      if (!carrier || !carrier.trim()) missingFields.push("Carrier");
      if (!trackingNumber || !trackingNumber.trim())
        missingFields.push("Tracking Number");
      if (!trackingLink || !trackingLink.trim())
        missingFields.push("Tracking Link");

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `${missingFields.join(", ")} ${missingFields.length === 1 ? "is" : "are"} required`,
          description:
            "Please provide carrier, tracking number, and tracking link when marking an order as shipped.",
        });
      }

      order.status = ORDER_STATUSES.SHIPPED;
      order.shipping.carrier = carrier.trim();
      order.shipping.trackingNumber = trackingNumber.trim();
      order.shipping.trackingLink = trackingLink.trim();
      order.shipping.shippedAt = new Date();
      await order.save();

      sendShippingNotificationEmail(order).catch(() => {});

      return res.status(200).json({
        success: true,
        message: "Order marked as shipped",
        order: {
          _id: order._id,
          status: order.status,
          shipping: order.shipping,
        },
      });
    }

    // Fallback (should not reach here)
    return res.status(400).json({
      success: false,
      message: "Unsupported status",
      description: `Status "${status}" is not supported for manual updates.`,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};
