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
  const rawTax =
    (session.total_details?.amount_tax ?? 0) / 100 ||
    Math.max(0, amountTotal - amountSubtotal - shippingFee);
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
