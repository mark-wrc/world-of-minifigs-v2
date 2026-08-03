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

export const buildStripeLineItem = (
  name,
  unitAmountCents,
  quantity,
  imageUrl,
  description,
) => ({
  price_data: {
    currency: "usd",
    product_data: {
      name,
      ...(description && { description }),
      ...(imageUrl && { images: [imageUrl] }),
    },
    unit_amount: unitAmountCents,
    tax_behavior: "exclusive",
  },
  quantity,
});
