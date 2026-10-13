import mongoose from "mongoose";
import User from "../models/user.model.js";
import OrderDraft from "../models/orderDraft.model.js";
import {
  createOrderFromPayment,
  createDealerOrderFromPayment,
  buildLineItemsForDirectProduct,
  buildLineItemsForDealer,
  buildCartLineItems,
  buildShipmentCheckout,
  createShipmentFromPayment,
  handleRefundUpdated,
  findOrderByCheckoutRef,
  FRONTEND_URL,
  getGateway,
  getEnabledGateways,
  getDefaultGateway,
  isGatewayEnabled,
} from "../services/payment/index.js";
import {
  PAYMENT_GATEWAYS,
  SHIPPING_MODES,
  SHIPMENT_CHECKOUT_TYPE,
} from "../constants/orderConstants.js";
import Order from "../models/order.model.js";
import Shipment from "../models/shipment.model.js";
import { buildLineItem } from "../utils/payment/index.js";
import {
  computeShippingInsurance,
  SHIPPING_INSURANCE_LABEL,
} from "../services/payment/paymentConfig.js";
import {
  findHeldOrders,
  getHeldDestination,
  findShipmentByCheckoutRef,
  SHIPMENT_ORDER_SUMMARY_FIELDS,
} from "../services/shipmentService.js";
import {
  DEFAULT_SHIPPING_COUNTRY,
  SHIPPING_COUNTRY_CODES,
  isSupportedShippingCountry,
  getShippingCountry,
} from "../../shared/shippingData.js";

// Routes a normalized payment result to the checkout that owns its order type.
const createOrderForPayment = (payment) => {
  const orderType = payment.metadata?.orderType;
  if (orderType === SHIPMENT_CHECKOUT_TYPE) {
    return createShipmentFromPayment(payment);
  }
  return orderType === "dealer" || orderType === "wholesale"
    ? createDealerOrderFromPayment(payment)
    : createOrderFromPayment(payment);
};

// The draft was already consumed by the other path (webhook vs success page),
// which is creating the record right now. Poll briefly (up to 6 s).
const waitForRecord = async (findByRef, checkoutRef) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const record = await findByRef(checkoutRef);
    if (record) return record;
  }
  return null;
};

const sendError = (res, { status, message, description }) =>
  res.status(status).json({ success: false, message, description });

const validateGateway = (gatewayName) =>
  isGatewayEnabled(gatewayName)
    ? null
    : {
        status: 400,
        message: "Payment method unavailable",
        description: "Please choose a different payment method.",
      };

// Pay Now, Ship Later choice for an order checkout. Holding only works when
// the held orders go to this same country — the flat rate is per country.
// Held orders ship through "Ship all now" (shipHeldOrders below), never
// alongside a new checkout.
const resolveFulfillment = async (userId, body, shippingCountry) => {
  const mode =
    body.shippingMode === SHIPPING_MODES.HOLD
      ? SHIPPING_MODES.HOLD
      : SHIPPING_MODES.SHIP_NOW;
  if (mode === SHIPPING_MODES.SHIP_NOW) return { fulfillment: { mode } };

  const held = await findHeldOrders(userId).select("_id shipping.address");
  const { country, mixed } = getHeldDestination(held);
  if (mixed || (country && country !== shippingCountry)) {
    const label = getShippingCountry(country)?.label || country;
    return {
      error: {
        status: 400,
        message: "Held orders ship elsewhere",
        description: mixed
          ? "Your held orders go to different countries. Please contact support to arrange shipping."
          : `Your held orders ship to ${label}. Choose ${label} as the destination to hold this order.`,
      },
    };
  }

  return { fulfillment: { mode } };
};

const sumLineItems = (lineItems) =>
  lineItems.reduce((sum, li) => sum + li.unitAmountCents * li.quantity, 0) /
  100;

// Optional 0.5% shipping insurance, any order type, charged with the shipping
// it protects: never on a held order, and on this order's items otherwise.
// Adds the line item and returns the amount.
const addShippingInsurance = (lineItems, { itemsSubtotal }) => {
  const amount = computeShippingInsurance(itemsSubtotal);
  if (amount > 0) {
    lineItems.push(
      buildLineItem(SHIPPING_INSURANCE_LABEL, Math.round(amount * 100), 1),
    );
  }
  return amount;
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
    const gatewayError = validateGateway(gatewayName);
    if (gatewayError) return sendError(res, gatewayError);

    const { fulfillment, error: fulfillmentError } = await resolveFulfillment(
      userId,
      body,
      shippingCountry,
    );
    if (fulfillmentError) return sendError(res, fulfillmentError);
    const isHeld = fulfillment.mode === SHIPPING_MODES.HOLD;

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

    if (body.shippingInsurance === true && !isHeld) {
      fulfillment.shippingInsurance = addShippingInsurance(lineItems, {
        itemsSubtotal: sumLineItems(lineItems),
      });
    }

    // Read back by the webhook when it builds the order.
    await OrderDraft.findByIdAndUpdate(metadata.draftId, { fulfillment });

    const { url, sessionRef, gatewayOrderId } = await getGateway(
      gatewayName,
    ).createCheckout({
      lineItems,
      shippingCountry,
      // The destination the buyer paid shipping for, checked against the
      // address they enter on the gateway's page.
      metadata: { ...metadata, shippingCountry, shippingMode: fulfillment.mode },
      userId,
      email: req.user.email,
      cancelUrl,
      // Held orders pay shipping later, in one flat fee for everything held.
      chargeShipping: !isHeld,
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

//----------------------------------- Confirm Checkout (Success Pages) -------------------------------------------
// Stripe returns `?session_id=`; Square returns `?gateway=square&ref=<draftId>`.
// Shared by the order and shipping-only checkouts — `findByRef` looks up the
// record the payment creates and `key` names it in the response.
const confirmCheckout = async (req, res, { findByRef, key, label }) => {
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

    // Square refs are guessable draft ids, so only the buyer may read the record.
    const notFound = () =>
      res.status(404).json({ success: false, message: `${label} not found` });
    const isOwner = (doc) => doc.userId.equals(req.user._id);
    const found = (record) =>
      res.status(200).json({ success: true, [key]: record });

    // 1. Check if the record already exists (webhook may have beaten us here)
    let record = await findByRef(checkoutRef);

    if (record) {
      if (isSquare && !isOwner(record)) return notFound();
      if (!isSquare && key === "order") {
        record = await gateway.patchReceiptFields(record);
      }
      return found(record);
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

    // 3. Atomically claim the draft and create the record.
    //    getDraftAndClean uses findByIdAndDelete so only one caller (this request
    //    or the webhook) will get the draft — the other gets null.
    if (payment) {
      const result = await createOrderForPayment(payment);
      if (result?.[key]) {
        return found(await findByRef(checkoutRef));
      }
    }

    // 4. Draft was already consumed by the webhook — wait for its record.
    record = await waitForRecord(findByRef, checkoutRef);
    if (record) {
      if (isSquare && !isOwner(record)) return notFound();
      return found(record);
    }

    return res.status(500).json({
      success: false,
      message: `${label} creation timed out. Please contact support.`,
    });
  } catch (error) {
    console.error(`Confirm ${key} error:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to load ${key}`,
    });
  }
};

export const confirmOrder = (req, res) =>
  confirmCheckout(req, res, {
    findByRef: findOrderByCheckoutRef,
    key: "order",
    label: "Order",
  });

// The shipment with a brief line per order it ships, for its success page.
const findShipmentForConfirm = (ref) =>
  findShipmentByCheckoutRef(ref)
    .select(
      "userId orders status shippingCountry payment.shippingFee payment.shippingInsurance payment.taxAmount payment.totalAmount payment.gateway payment.receiptUrl payment.receiptNumber payment.paidAt shipping.address refund.status refund.amount createdAt",
    )
    .populate({ path: "orders", select: SHIPMENT_ORDER_SUMMARY_FIELDS });

export const confirmShipment = (req, res) =>
  confirmCheckout(req, res, {
    findByRef: findShipmentForConfirm,
    key: "shipment",
    label: "Shipment",
  });

//----------------------------------- Ship Held Orders (Shipping-Only Checkout) ------------------------------------------
// "Ship my held orders" with nothing new to buy — one checkout for the flat fee.
export const shipHeldOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const body = req.body || {};

    const gatewayName = body.gateway || getDefaultGateway();
    const gatewayError = validateGateway(gatewayName);
    if (gatewayError) return sendError(res, gatewayError);

    const result = await buildShipmentCheckout(userId, {
      shippingInsurance: body.shippingInsurance === true,
    });
    if (result.error) return sendError(res, result.error);

    const { lineItems, metadata, shippingCountry } = result;
    const { url, sessionRef, gatewayOrderId } = await getGateway(
      gatewayName,
    ).createCheckout({
      lineItems,
      shippingCountry,
      metadata: { ...metadata, shippingCountry },
      userId,
      email: req.user.email,
      cancelUrl: `${FRONTEND_URL}/purchase`,
      // The fee is the line item itself, and no promo codes apply to it.
      chargeShipping: false,
      allowPromotions: false,
      returnPath: "/shipment/success",
    });

    if (gatewayOrderId) {
      await OrderDraft.findByIdAndUpdate(metadata.draftId, {
        gatewayRef: gatewayOrderId,
      });
    }

    return res.status(200).json({ success: true, url, sessionId: sessionRef });
  } catch (error) {
    console.error("Ship held orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start shipping checkout",
      description:
        error?.message || "An unexpected error occurred. Please try again.",
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

        // Repeat deliveries for an order or shipment we already have: skip
        // the API calls.
        const byGatewayOrder = { "payment.gatewayOrderId": payment.order_id };
        const exists =
          (await Order.exists(byGatewayOrder)) ||
          (await Shipment.exists(byGatewayOrder));
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
