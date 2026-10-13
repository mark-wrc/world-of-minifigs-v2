import Order from "../models/order.model.js";
import {
  sendShippingNotificationEmail,
  sendOrderCancelledEmail,
  sendOrderDeliveredEmail,
} from "../services/orderEmailService.js";
import {
  normalizePagination,
  buildSearchQuery,
} from "../utils/pagination.js";
import {
  ORDER_STATUSES,
  REFUND_STATUSES,
  VALID_STATUS_TRANSITIONS,
  CANCELLATION_REASONS,
  DELIVERY_METHODS,
  SHIPMENT_STATUSES,
} from "../constants/orderConstants.js";
import Shipment from "../models/shipment.model.js";
import {
  getHeldSummary,
  shipShipment,
  SHIPMENT_ORDER_SUMMARY_FIELDS,
} from "../services/shipmentService.js";
import {
  releaseOrderShipmentSafely,
  validateUserCancellationRequest,
  ensureOrderIsUserCancellable,
  acquireCancellationLock,
  releaseCancellationLock,
  createRefundForOrder,
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
    "payment.receiptNumber",
    "items.productName",
  ]);
};

// Grouped lists also find a shipment by its shipping invoice number — the
// match pulls in every order in that parcel.
const buildGroupedSearchQuery = async (search, scope = {}) => {
  const orderQuery = buildOrderSearchQuery(search);
  if (!search) return orderQuery;

  const shipments = await Shipment.find({
    ...scope,
    "payment.receiptNumber": new RegExp(search, "i"),
  })
    .select("_id")
    .lean();
  if (!shipments.length) return orderQuery;

  return {
    $or: [
      ...orderQuery.$or,
      { shipmentId: { $in: shipments.map((s) => s._id) } },
    ],
  };
};

// The consolidated shipment an order belongs to, with a brief line per order.
const shipmentPopulate = (select) => ({
  path: "shipmentId",
  select,
  populate: { path: "orders", select: SHIPMENT_ORDER_SUMMARY_FIELDS },
});

const USER_SHIPMENT_FIELDS =
  "orders status paymentSource shipping.carrier shipping.trackingNumber shipping.trackingLink shipping.shippedAt payment.shippingFee payment.shippingInsurance payment.totalAmount payment.gateway payment.receiptUrl payment.receiptNumber";

// Admin status filter value for paid orders that belong to a consolidated
// shipment — the "ready to pack (consolidated)" queue.
const CONSOLIDATED_FILTER = "consolidated";

const applyPopulate = (query, populate = []) =>
  populate.reduce((q, pop) => q.populate(pop), query);

/**
 * Paginated order list where every consolidated shipment is one row.
 *
 * Filters and search match individual orders; a shipment is listed when any
 * of its orders match and then carries all of its orders. Orders outside a
 * shipment (including held ones) stay a row each. Paging counts rows, and a
 * shipment sorts by when its shipping was paid, not by its oldest order.
 *
 * Each row is `{ _id, type: "shipment", shipment, orders }` or
 * `{ _id, type: "order", order }`.
 */
const paginateOrderGroups = async (
  match,
  {
    page,
    limit,
    oldestFirst = false,
    scope = {},
    orderSelect,
    orderPopulate,
    shipmentSelect,
  },
) => {
  const dir = oldestFirst ? 1 : -1;
  const [facet] = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $ifNull: ["$shipmentId", "$_id"] },
        isShipment: { $max: { $gt: ["$shipmentId", null] } },
        latest: { $max: "$createdAt" },
        earliest: { $min: "$createdAt" },
      },
    },
    {
      $lookup: {
        from: Shipment.collection.name,
        localField: "_id",
        foreignField: "_id",
        as: "shipmentDoc",
      },
    },
    {
      $addFields: {
        sortDate: {
          $ifNull: [
            { $arrayElemAt: ["$shipmentDoc.createdAt", 0] },
            oldestFirst ? "$earliest" : "$latest",
          ],
        },
      },
    },
    { $project: { shipmentDoc: 0 } },
    { $sort: { sortDate: dir, _id: dir } },
    {
      $facet: {
        rows: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: "count" }],
      },
    },
  ]);

  const rows = facet?.rows || [];
  const totalItems = facet?.total?.[0]?.count || 0;
  const shipmentIds = rows.filter((r) => r.isShipment).map((r) => r._id);
  const orderIds = rows.filter((r) => !r.isShipment).map((r) => r._id);

  const [shipments, orders] = await Promise.all([
    shipmentIds.length
      ? Shipment.find({ _id: { $in: shipmentIds } })
          .select(shipmentSelect)
          .lean()
      : [],
    rows.length
      ? applyPopulate(
          Order.find({
            ...scope,
            $or: [
              { _id: { $in: orderIds } },
              { shipmentId: { $in: shipmentIds } },
            ],
          })
            .select(orderSelect)
            .sort({ createdAt: 1 }),
          orderPopulate,
        ).lean()
      : [],
  ]);

  const shipmentById = new Map(shipments.map((s) => [String(s._id), s]));
  const orderById = new Map(orders.map((o) => [String(o._id), o]));
  const ordersByShipment = new Map();
  for (const order of orders) {
    const key = String(order.shipmentId?._id || order.shipmentId || "");
    if (!shipmentIds.some((id) => String(id) === key)) continue;
    if (!ordersByShipment.has(key)) ordersByShipment.set(key, []);
    ordersByShipment.get(key).push(order);
  }

  const groups = rows
    .map((row) => {
      const key = String(row._id);
      if (row.isShipment) {
        return {
          _id: row._id,
          type: "shipment",
          shipment: shipmentById.get(key) || { _id: row._id },
          orders: ordersByShipment.get(key) || [],
        };
      }
      const order = orderById.get(key);
      return order ? { _id: row._id, type: "order", order } : null;
    })
    .filter(Boolean);

  const totalPages = Math.ceil(totalItems / limit);
  return {
    success: true,
    groups,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
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
      deliveryMethods: DELIVERY_METHODS,
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

    const query = {
      userId,
      ...(await buildGroupedSearchQuery(search, { userId })),
    };

    // Filter by status tab (supports comma-separated for "Cancelled" tab)
    if (status) {
      const statuses = status.split(",").map((s) => s.trim());
      query.status = { $in: statuses };
    }

    // Orders that ship together are one row: the shipment, with its orders.
    const result = await paginateOrderGroups(query, {
      page,
      limit,
      scope: { userId },
      orderSelect:
        "-payment.stripeSessionId -payment.stripePaymentIntentId -payment.checkoutSessionId -payment.gatewayOrderId -payment.transactionId -__v -cancellation.isLocked -cancellation.lockExpiresAt -cancellation.cancelledById -refund.arn -delivery.deliveredById",
      orderPopulate: [shipmentPopulate(USER_SHIPMENT_FIELDS)],
      shipmentSelect: `${USER_SHIPMENT_FIELDS} createdAt payment.paidAt`,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get user orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get Held Orders (Pay Now, Ship Later) ------------------------------------------

export const getHeldOrders = async (req, res) => {
  try {
    const summary = await getHeldSummary(req.user._id);
    return res.status(200).json({ success: true, ...summary });
  } catch (error) {
    console.error("Get held orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch held orders",
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

    const order = await Order.findOne({ _id: id, userId })
      .select(
        "-payment.stripeSessionId -payment.checkoutSessionId -payment.gatewayOrderId -__v -cancellation.isLocked -cancellation.lockExpiresAt -cancellation.cancelledById -refund.arn -delivery.deliveredById",
      )
      .populate(shipmentPopulate(USER_SHIPMENT_FIELDS));

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
        description: "The requested order does not exist.",
      });
    }

    // Sync refund status from the payment gateway if still pending
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

    // Initiate gateway refund
    let refund;
    try {
      refund = await createRefundForOrder(order);
    } catch (refundErr) {
      await releaseCancellationLock(order);

      console.error(
        `Refund failed for order ${order._id}:`,
        refundErr.message,
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
      refundId: refund.id,
      refundAmount: refund.amount,
    });

    await restockOrderItemsSafely(order);

    await order.save();

    await releaseOrderShipmentSafely(order);

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

    const query = await buildGroupedSearchQuery(search);
    // Held orders read oldest first (what's been in storage longest), and so
    // does the consolidated packing queue.
    let oldestFirst = false;
    if (status === CONSOLIDATED_FILTER) {
      query.status = ORDER_STATUSES.PAID;
      query.shipmentId = { $ne: null };
      oldestFirst = true;
    } else if (status) {
      const statuses = status.split(",").map((s) => s.trim());
      query.status = { $in: statuses };
      if (statuses.length === 1 && statuses[0] === ORDER_STATUSES.ON_HOLD) {
        oldestFirst = true;
      }
    }

    // Orders that ship together are one row: the shipment, with its orders.
    const result = await paginateOrderGroups(query, {
      page,
      limit,
      oldestFirst,
      shipmentSelect: "-payment.checkoutSessionId -payment.transactionId -__v",
      orderSelect:
        "-payment.stripeSessionId -payment.stripePaymentIntentId -payment.checkoutSessionId -payment.transactionId -__v",
      orderPopulate: [
        shipmentPopulate(
          "orders status paymentSource reviewNote shipping payment.shippingFee payment.shippingInsurance payment.taxAmount payment.totalAmount payment.gateway payment.receiptUrl payment.receiptNumber payment.paidAt",
        ),
        {
          path: "userId",
          select: "firstName lastName",
        },
        {
          path: "cancellation.cancelledById",
          select: "firstName lastName",
        },
        {
          path: "delivery.deliveredById",
          select: "firstName lastName",
        },
      ],
    });

    return res.status(200).json(result);
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
      {
        path: "delivery.deliveredById",
        select: "firstName lastName",
      },
      shipmentPopulate("-__v"),
    ]);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
        description: "The requested order does not exist.",
      });
    }

    // Sync refund status from the payment gateway if still pending
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
    const {
      status,
      carrier,
      trackingNumber,
      trackingLink,
      reason,
      notes,
      deliveryMethod,
      receivedBy,
    } = req.body;

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

    // An order in a paid consolidated shipment ships with its parcel — its
    // shipping is paid, so it can't be handed over on its own. It can still
    // be cancelled; "shipped" ships the whole parcel (below).
    if (status === ORDER_STATUSES.DELIVERED && order.shipmentId) {
      const parcel = await Shipment.findById(order.shipmentId).select("status");
      if (parcel?.status === SHIPMENT_STATUSES.PAID) {
        return res.status(400).json({
          success: false,
          message: "Order ships with its shipment",
          description:
            "This order is part of a paid consolidated shipment. Mark the shipment as shipped, or cancel this order.",
        });
      }
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

      // Initiate gateway refund
      let refund;
      try {
        refund = await createRefundForOrder(order);
      } catch (refundErr) {
        await releaseCancellationLock(order);

        console.error(
          `Refund failed for order ${order._id}:`,
          refundErr.message,
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
        refundId: refund.id,
        refundAmount: refund.amount,
      });

      await restockOrderItemsSafely(order);

      await order.save();

      await releaseOrderShipmentSafely(order);

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

      // Part of a consolidated shipment — the whole parcel ships together
      // under one tracking number.
      const shipment = order.shipmentId
        ? await Shipment.findById(order.shipmentId)
        : null;
      if (shipment?.status === SHIPMENT_STATUSES.PAID) {
        const shippedOrders = await shipShipment(shipment, {
          carrier: carrier.trim(),
          trackingNumber: trackingNumber.trim(),
          trackingLink: trackingLink.trim(),
        });

        return res.status(200).json({
          success: true,
          message: `Shipment marked as shipped (${shippedOrders.length} order${shippedOrders.length === 1 ? "" : "s"})`,
          order: {
            _id: order._id,
            status: ORDER_STATUSES.SHIPPED,
            shipping: shipment.shipping,
          },
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

    // Delivered — hand delivery or in-store pick-up only; requires the method
    if (status === ORDER_STATUSES.DELIVERED) {
      if (!Object.values(DELIVERY_METHODS).includes(deliveryMethod)) {
        return res.status(400).json({
          success: false,
          message: "Delivery method is required",
          description:
            "Please select how the order was handed over — hand delivered or picked up in store.",
        });
      }

      order.status = ORDER_STATUSES.DELIVERED;
      order.delivery.method = deliveryMethod;
      order.delivery.receivedBy = receivedBy?.trim() || undefined;
      order.delivery.notes = notes?.trim() || undefined;
      order.delivery.deliveredAt = new Date();
      order.delivery.deliveredById = req.user._id;
      await order.save();

      sendOrderDeliveredEmail(order).catch(() => {});

      return res.status(200).json({
        success: true,
        message: "Order marked as delivered",
        order: {
          _id: order._id,
          status: order.status,
          delivery: order.delivery,
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
