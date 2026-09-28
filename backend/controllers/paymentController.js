import mongoose from "mongoose";
import User from "../models/user.model.js";
import OrderDraft from "../models/orderDraft.model.js";
import {
  createOrderFromPayment,
  createDealerOrderFromPayment,
  buildLineItemsForDirectProduct,
  buildLineItemsForDealer,
  buildCartLineItems,
  handleRefundUpdated,
  findOrderByCheckoutRef,
  FRONTEND_URL,
  getGateway,
  getEnabledGateways,
  getDefaultGateway,
  isGatewayEnabled,
} from "../services/payment/index.js";
import { PAYMENT_GATEWAYS } from "../constants/orderConstants.js";
import Order from "../models/order.model.js";
import {
  DEFAULT_SHIPPING_COUNTRY,
  SHIPPING_COUNTRY_CODES,
  isSupportedShippingCountry,
} from "../../shared/shippingData.js";

// Routes a normalized payment result to the checkout that owns its order type.
const createOrderForPayment = (payment) => {
  const orderType = payment.metadata?.orderType;
  return orderType === "dealer" || orderType === "wholesale"
    ? createDealerOrderFromPayment(payment)
    : createOrderFromPayment(payment);
};

// The draft was already consumed by the other path (webhook vs success page),
// which is creating the order right now. Poll briefly (up to 6 s).
const waitForOrder = async (checkoutRef) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const order = await findOrderByCheckoutRef(checkoutRef);
    if (order) return order;
  }
  return null;
};

//----------------------------------- Payment Config ------------------------------------------
export const getPaymentConfig = (_req, res) => {
  res.status(200).json({
    success: true,
    gateways: getEnabledGateways(),
    defaultGateway: getDefaultGateway(),
  });
};

//----------------------------------- Create Checkout Session ------------------------------------------
export const createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const body = req.body || {};
    const { productId, orderType } = body;

    const shippingCountry = body.shippingCountry || DEFAULT_SHIPPING_COUNTRY;
    if (!isSupportedShippingCountry(shippingCountry)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported shipping destination",
        description: `We currently ship to: ${SHIPPING_COUNTRY_CODES.join(", ")}.`,
      });
    }

    const gatewayName = body.gateway || getDefaultGateway();
    if (!isGatewayEnabled(gatewayName)) {
      return res.status(400).json({
        success: false,
        message: "Payment method unavailable",
        description: "Please choose a different payment method.",
      });
    }

    let lineItems;
    let metadata = { orderType: "product" };

    const isChannelOrder = orderType === "dealer" || orderType === "wholesale";

    if (isChannelOrder) {
      // Shared dealer/wholesale checkout flow — same data, just a different tag.
      const result = await buildLineItemsForDealer(body, userId, orderType);
      if (result.error) {
        return res.status(result.error.status).json({
          success: false,
          message: result.error.message,
          description: result.error.description,
        });
      }
      lineItems = result.lineItems;
      metadata = result.metadata;
    } else if (productId) {
      const result = await buildLineItemsForDirectProduct(body, userId);
      if (result.error) {
        return res.status(result.error.status).json({
          success: false,
          message: result.error.message,
          description: result.error.description,
        });
      }
      lineItems = result.lineItems;
      metadata = result.metadata;
    } else {
      const result = await buildCartLineItems(userId);
      if (result.error) {
        return res.status(result.error.status).json({
          success: false,
          message: result.error.message,
          description: result.error.description,
        });
      }
      lineItems = result.lineItems;
      metadata = result.metadata;
    }

    const cancelUrl =
      orderType === "wholesale"
        ? `${FRONTEND_URL}/wholesalers`
        : orderType === "dealer"
          ? `${FRONTEND_URL}/dealers`
          : FRONTEND_URL;

    const { url, sessionRef, gatewayOrderId } = await getGateway(
      gatewayName,
    ).createCheckout({
      lineItems,
      shippingCountry,
      // The destination the buyer paid shipping for, checked against the
      // address they enter on the gateway's page.
      metadata: { ...metadata, shippingCountry },
      userId,
      email: req.user.email,
      cancelUrl,
    });

    // Square: remember its order so the success page can check the payment
    // before the webhook lands.
    if (gatewayOrderId) {
      await OrderDraft.findByIdAndUpdate(metadata.draftId, {
        gatewayRef: gatewayOrderId,
      });
    }

    return res.status(200).json({
      success: true,
      url,
      sessionId: sessionRef,
    });
  } catch (error) {
    console.error("Create checkout session error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create checkout session",
      description:
        error?.message || "An unexpected error occurred. Please try again.",
    });
  }
};

//----------------------------------- Confirm Order (Success Page) -------------------------------------------
// Stripe returns `?session_id=`; Square returns `?gateway=square&ref=<draftId>`.
export const confirmOrder = async (req, res) => {
  try {
    const gatewayName = req.query.gateway || PAYMENT_GATEWAYS.STRIPE;
    const isSquare = gatewayName === PAYMENT_GATEWAYS.SQUARE;
    const checkoutRef = isSquare ? req.query.ref : req.query.session_id;
    const gateway = getGateway(gatewayName);

    if (!gateway || !checkoutRef || (isSquare && !mongoose.isValidObjectId(checkoutRef))) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    // Square refs are guessable draft ids, so only the buyer may read the order.
    const notFound = () =>
      res.status(404).json({ success: false, message: "Order not found" });
    const isOwner = (doc) => doc.userId.equals(req.user._id);

    // 1. Check if the order already exists (webhook may have beaten us here)
    let order = await findOrderByCheckoutRef(checkoutRef);

    if (order) {
      if (isSquare && !isOwner(order)) return notFound();
      if (!isSquare) order = await gateway.patchReceiptFields(order);
      return res.status(200).json({ success: true, order });
    }

    // 2. Verify payment status with the gateway
    let payment = null;
    if (isSquare) {
      // No draft means the webhook already claimed it — skip to polling.
      const draft = await OrderDraft.findById(checkoutRef).lean();
      if (draft) {
        if (!isOwner(draft)) return notFound();
        if (draft.gatewayRef) {
          payment = await gateway.fetchPaidSession(draft.gatewayRef);
        }
        if (!payment) {
          return res.status(402).json({
            success: false,
            message: "Payment not confirmed yet. Please wait or refresh.",
          });
        }
      }
    } else {
      payment = await gateway.fetchPaidSession(checkoutRef);
      if (!payment) {
        return res.status(402).json({
          success: false,
          message: "Payment not confirmed yet. Please wait or refresh.",
        });
      }
    }

    // 3. Atomically claim the draft and create the order.
    //    getDraftAndClean uses findByIdAndDelete so only one caller (this request
    //    or the webhook) will get the draft — the other gets null.
    if (payment) {
      const result = await createOrderForPayment(payment);
      if (result?.order) {
        return res.status(200).json({ success: true, order: result.order });
      }
    }

    // 4. Draft was already consumed by the webhook — wait for its order.
    order = await waitForOrder(checkoutRef);
    if (order) {
      if (isSquare && !isOwner(order)) return notFound();
      return res.status(200).json({ success: true, order });
    }

    return res.status(500).json({
      success: false,
      message: "Order creation timed out. Please contact support.",
    });
  } catch (error) {
    console.error("Confirm order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load order",
    });
  }
};

//------------------------------------------------ Stripe Webhook ------------------------------------------
export const stripeWebhook = async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not set");
      return res.status(500).json({ received: false });
    }
    const stripeGateway = getGateway(PAYMENT_GATEWAYS.STRIPE);
    const event = stripeGateway.verifyWebhook(req.body, req.headers);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = await stripeGateway.retrieveSession(
          event.data.object.id,
        );

        try {
          await createOrderForPayment(
            await stripeGateway.normalizeSession(session),
          );
        } catch (err) {
          console.error("Webhook: error creating order:", err);
          return res.status(500).json({ received: false });
        }
        break;
      }
      case "refund.updated": {
        try {
          await handleRefundUpdated(
            stripeGateway.normalizeRefund(event.data.object),
          );
        } catch (err) {
          console.error("Webhook: error processing refund:", err);
          return res.status(500).json({ received: false });
        }
        break;
      }

      case "customer.updated": {
        try {
          const customer = event.data.object;
          const stripeCustomerId = customer.id;
          const taxExempt = customer.tax_exempt;

          // Only sync if tax_exempt changed to a known value
          if (taxExempt === "exempt" || taxExempt === "none") {
            const isTaxExempt = taxExempt === "exempt";
            await User.findOneAndUpdate(
              { stripeCustomerId },
              { isTaxExempt },
            );
          }
        } catch (err) {
          console.error("Webhook: error syncing customer update:", err);
        }
        break;
      }

      default:
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    res.status(400).json({ received: false });
  }
};

//------------------------------------------------ Square Webhook ------------------------------------------
export const squareWebhook = async (req, res) => {
  const squareGateway = getGateway(PAYMENT_GATEWAYS.SQUARE);

  if (!squareGateway.isWebhookConfigured()) {
    console.error(
      "SQUARE_WEBHOOK_SIGNATURE_KEY / SQUARE_WEBHOOK_NOTIFICATION_URL is not set",
    );
    return res.status(500).json({ received: false });
  }

  let event;
  try {
    event = await squareGateway.verifyWebhook(req.body, req.headers);
  } catch (err) {
    console.error("Square webhook verification failed:", err.message);
    return res.status(400).json({ received: false });
  }

  try {
    switch (event.type) {
      case "payment.created":
      case "payment.updated": {
        // Fires on every change to a payment — only a completed one matters.
        const payment = event.data?.object?.payment;
        if (payment?.status !== "COMPLETED" || !payment.order_id) break;

        // Repeat deliveries for an order we already have: skip the API calls.
        const exists = await Order.exists({
          "payment.gatewayOrderId": payment.order_id,
        });
        if (exists) break;

        const result = await squareGateway.fetchPaidSession(payment.order_id);
        if (result) await createOrderForPayment(result);
        break;
      }

      case "refund.created":
      case "refund.updated": {
        const refund = event.data?.object?.refund;
        if (refund) {
          await handleRefundUpdated(squareGateway.normalizeWebhookRefund(refund));
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Square webhook: error handling ${event.type}:`, err);
    return res.status(500).json({ received: false });
  }

  res.status(200).json({ received: true });
};
