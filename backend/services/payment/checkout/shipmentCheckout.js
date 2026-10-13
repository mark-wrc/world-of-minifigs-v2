import Shipment from "../../../models/shipment.model.js";
import { buildLineItem } from "../../../utils/payment/index.js";
import { saveOrderDraft, getDraftAndClean } from "../paymentCore.js";
import {
  STRIPE_SHIPPING_TAX_CODE,
  SHIPPING_INSURANCE_LABEL,
  computeShippingInsurance,
} from "../paymentConfig.js";
import {
  SHIPMENT_CHECKOUT_TYPE,
  SHIPMENT_STATUSES,
  SHIPMENT_PAYMENT_SOURCES,
} from "../../../constants/orderConstants.js";
import { resolveShippingCountry } from "../../../../shared/shippingData.js";
import {
  findHeldOrders,
  getHeldDestination,
  fillStandaloneShipment,
  findShipmentByCheckoutRef,
} from "../../shipmentService.js";

const round2 = (n) => Math.round(n * 100) / 100;

// ------------ Build the Shipping-Only Checkout ------------
// "Ship my held orders" with nothing new to buy: one line item for the flat
// fee of the country the held orders go to, plus — when asked for — the
// optional 0.5% insurance on the items of every order in the parcel.

export async function buildShipmentCheckout(
  userId,
  { shippingInsurance: wantsInsurance = false } = {},
) {
  const held = await findHeldOrders(userId).select(
    "_id shipping.address payment.subtotal",
  );

  if (held.length === 0) {
    return {
      error: {
        status: 400,
        message: "No held orders",
        description: "You don't have any orders waiting to be shipped.",
      },
    };
  }

  const { country: heldCountry, mixed } = getHeldDestination(held);
  if (mixed) {
    return {
      error: {
        status: 400,
        message: "Held orders go to different countries",
        description:
          "Your held orders can't share one shipment. Please contact support to arrange shipping.",
      },
    };
  }

  const country = resolveShippingCountry(heldCountry);
  const orderIds = held.map((o) => o._id);
  const count = orderIds.length;

  const lineItems = [
    {
      ...buildLineItem(
        `Consolidated shipping (${count} order${count === 1 ? "" : "s"})`,
        country.amount,
        1,
        undefined,
        country.displayName,
      ),
      taxCode: STRIPE_SHIPPING_TAX_CODE,
    },
  ];

  const shippingInsurance = wantsInsurance
    ? computeShippingInsurance(
        held.reduce((sum, o) => sum + (o.payment?.subtotal || 0), 0),
      )
    : 0;
  if (shippingInsurance > 0) {
    lineItems.push(
      buildLineItem(
        SHIPPING_INSURANCE_LABEL,
        Math.round(shippingInsurance * 100),
        1,
      ),
    );
  }

  const draftId = await saveOrderDraft(userId, SHIPMENT_CHECKOUT_TYPE, {
    orderIds,
    shippingInsurance,
  });

  return {
    lineItems,
    shippingCountry: country.code,
    metadata: { orderType: SHIPMENT_CHECKOUT_TYPE, draftId },
  };
}

// ------------ Create the Shipment from a Completed Payment ------------
// `payment` is the normalized result from any gateway.

export async function createShipmentFromPayment(payment) {
  const meta = payment.metadata || {};
  if (meta.orderType !== SHIPMENT_CHECKOUT_TYPE) return null;

  // Atomic claim — only one of the webhook / success page gets the draft.
  const draft = await getDraftAndClean(meta.draftId);
  if (!draft) {
    console.error("createShipmentFromPayment: draft not found", meta.draftId);
    return null;
  }

  const existing = await findShipmentByCheckoutRef(payment.sessionId);
  if (existing) return { shipment: existing, created: false };

  const { totals } = payment;
  const shippingInsurance = draft.payload?.shippingInsurance || 0;
  const shipment = await Shipment.create({
    userId: payment.userId,
    email: payment.email || undefined,
    status: SHIPMENT_STATUSES.PAID,
    shippingCountry: meta.shippingCountry,
    paymentSource: SHIPMENT_PAYMENT_SOURCES.STANDALONE,
    payment: {
      gateway: payment.gateway,
      shippingFee: round2(
        totals.totalAmount - totals.taxAmount - shippingInsurance,
      ),
      shippingInsurance,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      checkoutSessionId: payment.sessionId,
      gatewayOrderId: payment.gatewayOrderId,
      transactionId: payment.transactionId,
      receiptNumber: payment.receiptNumber,
      receiptUrl: payment.receiptUrl || undefined,
      paidAt: new Date(),
    },
    shipping: { address: payment.shippingAddress },
  });

  await fillStandaloneShipment(shipment, draft.payload?.orderIds);

  return { shipment, created: true };
}
