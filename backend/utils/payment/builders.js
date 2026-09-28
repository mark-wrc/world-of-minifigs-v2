// ------------------------- Pricing --------------------------------

export const computeUnitPrice = (price, discount, discountPrice) => {
  if (discountPrice != null && discountPrice >= 0) return Number(discountPrice);
  const disc = discount || 0;
  return Math.round(price * (1 - disc / 100) * 100) / 100;
};

// ------------------------- Universal Builders --------------------------------

export const buildOrderItem = ({
  productName,
  colorName,
  quantity,
  unitPrice,
  basePrice,
  discount,
  imageUrl,
  productId,
  variantIndex,
}) => ({
  productId: productId || undefined,
  productName,
  colorName: colorName || undefined,
  variantIndex: variantIndex ?? undefined,
  quantity,
  basePrice: basePrice ?? unitPrice,
  discount: discount || 0,
  unitPrice,
  totalPrice: Math.round(unitPrice * quantity * 100) / 100,
  imageUrl: imageUrl || undefined,
});

// Gateway-neutral line item — each gateway translates it to its own wire
// format at the last moment (see services/payment/gateways).
export const buildLineItem = (
  name,
  unitAmountCents,
  quantity,
  imageUrl,
  description,
) => ({
  name,
  unitAmountCents,
  quantity,
  imageUrl: imageUrl || undefined,
  description: description || undefined,
});
