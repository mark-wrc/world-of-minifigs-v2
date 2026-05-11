// ------------------------- Extract Stripe Session ------------------------------

export const extractShippingAddress = (session) => {
  const shipping = session.collected_information?.shipping_details;

  if (!shipping?.address?.line1) {
    console.error("Shipping address missing or incomplete:", shipping);
    return undefined;
  }

  return {
    name: shipping.name,
    line1: shipping.address.line1,
    line2: shipping.address?.line2 || undefined,
    city: shipping.address?.city,
    state: shipping.address?.state,
    postalCode: shipping.address?.postal_code,
    country: shipping.address?.country,
    phone: session.customer_details?.phone || undefined,
  };
};

export const extractBillingDetails = (session, shippingAddress) => {
  const customer = session.customer_details;
  if (!customer?.name && !customer?.address?.country) return undefined;

  const billingName = customer.name || "";
  const billingCountry = customer.address?.country || "";
  const shippingName = shippingAddress?.name || "";
  const shippingCountry = shippingAddress?.country || "";

  // Skip billing when it matches shipping
  if (
    billingName.toLowerCase() === shippingName.toLowerCase() &&
    billingCountry.toUpperCase() === shippingCountry.toUpperCase()
  ) {
    return undefined;
  }

  return {
    cardHolderName: customer.name || undefined,
    country: customer.address?.country || undefined,
  };
};

export const extractSessionTotals = (session, orderItems) => {
  const subtotal = Array.isArray(orderItems)
    ? Math.round(orderItems.reduce((s, i) => s + i.totalPrice, 0) * 100) / 100
    : 0;
  const amountSubtotal =
    Math.round(session.amount_subtotal ?? subtotal * 100) / 100;
  const amountTotal = Math.round(session.amount_total ?? subtotal * 100) / 100;
  const shippingFee =
    Math.round(session.total_details?.amount_shipping ?? 0) / 100;
  const discountAmount =
    Math.round(session.total_details?.amount_discount ?? 0) / 100;
  const rawTax =
    (session.total_details?.amount_tax ?? 0) / 100 ||
    Math.max(0, amountTotal - amountSubtotal - shippingFee + discountAmount);
  const taxAmount = Math.round(rawTax * 100) / 100;
  const email = session.customer_details?.email || session.customer_email;

  return {
    subtotal: amountSubtotal,
    shippingFee,
    taxAmount,
    totalAmount: amountTotal,
    email,
  };
};

// ------------------------- Extract Discount Info --------------------------
export const extractDiscountInfo = async (session) => {
  const totalDiscount = session.total_details?.amount_discount ?? 0;
  const sessionDiscounts = Array.isArray(session.discounts)
    ? session.discounts
    : [];

  if (totalDiscount <= 0 && sessionDiscounts.length === 0) return undefined;

  const entry = sessionDiscounts[0] || {};
  const promotionCode =
    entry.promotion_code && typeof entry.promotion_code === "object"
      ? entry.promotion_code
      : null;

  // Locate the coupon. It can be expanded at any of the three paths above.
  let coupon = null;
  let couponId;
  if (entry.coupon && typeof entry.coupon === "object") {
    coupon = entry.coupon;
    couponId = coupon.id;
  } else if (typeof entry.coupon === "string") {
    couponId = entry.coupon;
  } else if (promotionCode?.coupon && typeof promotionCode.coupon === "object") {
    coupon = promotionCode.coupon;
    couponId = coupon.id;
  } else if (typeof promotionCode?.coupon === "string") {
    couponId = promotionCode.coupon;
  } else if (
    promotionCode?.promotion?.coupon &&
    typeof promotionCode.promotion.coupon === "object"
  ) {
    coupon = promotionCode.promotion.coupon;
    couponId = coupon.id;
  } else if (typeof promotionCode?.promotion?.coupon === "string") {
    couponId = promotionCode.promotion.coupon;
  }

  // If we only have a coupon ID, fetch the full Coupon to get its name + off
  // values. This is the case for the new Promotions API where the nested
  // coupon isn't expandable from the session.
  if (!coupon && couponId) {
    try {
      const { getStripe } = await import("../stripe.js");
      coupon = await getStripe().coupons.retrieve(couponId);
    } catch (err) {
      console.warn("[discount] failed to fetch coupon", couponId, err.message);
    }
  }

  // Fallback to the per-discount breakdown amount if the session-level total
  // isn't present (older API responses).
  const breakdownDiscounts =
    session.total_details?.breakdown?.discounts ?? [];
  const breakdownAmount = breakdownDiscounts.reduce(
    (sum, d) => sum + (d.amount || 0),
    0,
  );
  const amountCents = totalDiscount || breakdownAmount;

  // Coupon.name is nullable in Stripe — falls back to coupon.id so we always
  // persist a human-readable label, even when the merchant didn't set a Name
  // on the coupon in Dashboard.
  const couponName = coupon?.name || couponId || undefined;

  return {
    amount: Math.round(amountCents) / 100,
    couponId,
    couponName,
    promotionCode: promotionCode?.code || undefined,
    promotionCodeId:
      promotionCode?.id ||
      (typeof entry.promotion_code === "string"
        ? entry.promotion_code
        : undefined),
    percentOff: coupon?.percent_off ?? undefined,
    amountOff:
      coupon?.amount_off != null ? coupon.amount_off / 100 : undefined,
  };
};

export const getFullSessionIfNeeded = async (rawSession, stripe) => {
  if (rawSession?.id && !rawSession?.shipping_details?.address) {
    try {
      return await stripe.checkout.sessions.retrieve(rawSession.id);
    } catch (e) {
      console.warn(
        "Could not retrieve full session, using payload:",
        e?.message,
      );
    }
  }
  return rawSession;
};
