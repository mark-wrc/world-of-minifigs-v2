import { getStripe } from "../utils/stripe.js";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import {
  createOrderFromStripeSession,
  createDealerOrderFromStripeSession,
  buildLineItemsForDirectProduct,
  buildLineItemsForDealer,
  buildCartLineItems,
  handleRefundUpdated,
  FRONTEND_URL,
  STRIPE_SESSION_CONFIG,
} from "../services/payment/index.js";

// Find existing Stripe customer or create one, caching the ID on the user
// Returns null if Stripe is unavailable (checkout falls back to customer_email)
const findOrCreateStripeCustomer = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const stripe = getStripe();

  // 1 — Try existing cached customer
  if (user.stripeCustomerId) {
    try {
      await stripe.customers.retrieve(user.stripeCustomerId);
      return user.stripeCustomerId;
    } catch {
      // Customer was deleted in Stripe — fall through to recreate
    }
  }

  // 2 — Search by email to avoid duplicates if DB save previously failed
  const existing = await stripe.customers.list({ email: user.email, limit: 1 });
  if (existing.data.length > 0) {
    const existingId = existing.data[0].id;
    await User.findByIdAndUpdate(userId, { stripeCustomerId: existingId });
    return existingId;
  }

  // 3 — Create new customer
  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    metadata: { userId: userId.toString() },
    tax_exempt: user.isTaxExempt ? "exempt" : "none",
  });

  await User.findByIdAndUpdate(userId, { stripeCustomerId: customer.id });
  return customer.id;
};

//----------------------------------- Create Checkout Session ------------------------------------------
export const createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const body = req.body || {};
    const { productId, orderType } = body;

    let lineItems;
    let metadata = { orderType: "product" };

    if (orderType === "dealer") {
      // Dealer checkout flow
      const result = await buildLineItemsForDealer(body, userId);
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
      orderType === "dealer" ? `${FRONTEND_URL}/dealers` : FRONTEND_URL;

    // Try to get/create a linked Stripe customer for tax exemption support
    // Falls back to customer_email if Stripe customer API is unavailable
    let customerParam = {};
    try {
      const stripeCustomerId = await findOrCreateStripeCustomer(userId);
      customerParam = { customer: stripeCustomerId };
    } catch (customerErr) {
      console.error("Stripe customer lookup failed, falling back to customer_email:", customerErr.message);
      customerParam = { customer_email: req.user.email };
    }

    const session = await getStripe().checkout.sessions.create({
      ...STRIPE_SESSION_CONFIG,
      line_items: lineItems,
      success_url: `${FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      client_reference_id: userId.toString(),
      ...customerParam,
      payment_intent_data: {
        receipt_email: req.user.email,
      },
      metadata,
    });

    return res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
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
export const confirmOrder = async (req, res) => {
  try {
    const sessionId = req.query.session_id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    // 1. Check if the webhook already created the order
    const existingOrder = await Order.findOne({
      "payment.stripeSessionId": sessionId,
    });

    if (existingOrder) {
      // If the webhook created the order before Stripe finalized the invoice,
      // patch the missing invoice fields now that the success page has loaded.
      if (!existingOrder.payment.stripeInvoiceNumber && !existingOrder.payment.invoiceUrl) {
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ["invoice"],
        });
        const invoiceNumber = session.invoice?.number;
        const invoiceUrl = session.invoice?.hosted_invoice_url;
        if (invoiceNumber || invoiceUrl) {
          await Order.findByIdAndUpdate(existingOrder._id, {
            "payment.stripeInvoiceNumber": invoiceNumber,
            "payment.invoiceUrl": invoiceUrl || undefined,
          });
          existingOrder.payment.stripeInvoiceNumber = invoiceNumber;
          existingOrder.payment.invoiceUrl = invoiceUrl;
        }
      }
      return res.status(200).json({ success: true, order: existingOrder });
    }

    // 2. Webhook hasn't arrived yet — retrieve session from Stripe as fallback
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["invoice"],
    });

    if (session.payment_status !== "paid") {
      return res.status(402).json({
        success: false,
        message: "Payment not confirmed yet. Please wait or refresh.",
      });
    }

    // 3. Create the order from the session (same logic as webhook)
    let result;
    const orderType = session.metadata?.orderType;

    if (orderType === "dealer") {
      result = await createDealerOrderFromStripeSession(session);
    } else {
      result = await createOrderFromStripeSession(session);
    }

    if (!result?.order) {
      return res.status(500).json({
        success: false,
        message: "Failed to create order. Please contact support.",
      });
    }

    return res.status(200).json({
      success: true,
      order: result.order,
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
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not set");
      return res.status(500).json({ received: false });
    }
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed": {
        const rawSession = event.data.object;
        const session = await stripe.checkout.sessions.retrieve(rawSession.id, {
          expand: ["invoice"],
        });

        try {
          const orderType = session.metadata?.orderType;
          if (orderType === "dealer") {
            await createDealerOrderFromStripeSession(session);
          } else {
            await createOrderFromStripeSession(session);
          }
        } catch (err) {
          console.error("Webhook: error creating order:", err);
          return res.status(500).json({ received: false });
        }
        break;
      }
      case "refund.updated": {
        try {
          await handleRefundUpdated(event.data.object);
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
