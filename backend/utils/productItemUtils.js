import { getPriceDisplayInfo } from "./Products/productPriceUtils.js";

//------------------------------------------- Variant Index -------------------------------------------------

export const parseVariantIndex = (value) => {
  if (
    value == null ||
    value === "" ||
    value === "null" ||
    value === "undefined"
  )
    return null;
  return Number(value);
};

//------------------------------------- Display (name, color, image, stock) ----------------------------------

export const getColorLabel = (product, productType, variantIndex) => {
  if (!product) return null;
  const isVariant = productType === "variant";
  const variant = isVariant ? product.variants?.[variantIndex] : null;
  const primaryColor = isVariant
    ? variant?.colorId?.colorName
    : product.colorId?.colorName;
  const secondaryColor = isVariant
    ? variant?.secondaryColorId?.colorName
    : product.secondaryColorId?.colorName;
  const label = [primaryColor, secondaryColor].filter(Boolean).join(" / ");
  return label || null;
};

export const getProductDisplayName = (product, productType, variantIndex) => {
  if (!product) return "Unknown";
  const colorLabel = getColorLabel(product, productType, variantIndex);
  return colorLabel
    ? `${product.productName} - ${colorLabel}`
    : product.productName;
};

export const getImageUrl = (product, productType, variantIndex) => {
  if (!product) return null;
  const isVariant = productType === "variant";
  const variant = isVariant ? product.variants?.[variantIndex] : null;
  return isVariant ? variant?.image?.url : product.images?.[0]?.url;
};

export const getStock = (product, productType, variantIndex) => {
  if (!product) return 0;
  const isVariant = productType === "variant";
  const variant = isVariant ? product.variants?.[variantIndex] : null;
  return isVariant ? (variant?.stock ?? 0) : (product?.stock ?? 0);
};

//------------------------------------- Cart Item Formatting -------------------------------------------------

export const getCartItemDisplayAndStock = (
  product,
  productType,
  variantIndex,
) => ({
  displayName: getProductDisplayName(product, productType, variantIndex),
  maxStock: getStock(product, productType, variantIndex),
});

export const formatCartItemForDisplay = (item) => {
  const product = item.productId;
  if (!product) return null;

  const productType = item.productType || product.productType;
  const variantIndex = item.variantIndex;
  const isVariant = productType === "variant";

  const priceInfo = getPriceDisplayInfo(product, item.quantity);
  const colorLabel = getColorLabel(product, productType, variantIndex);
  const imageUrl = getImageUrl(product, productType, variantIndex);
  const stock = getStock(product, productType, variantIndex);

  const formatted = {
    productId: product._id,
    productName: product.productName,
    quantity: item.quantity,
    productType,
    image: imageUrl || undefined,
    stock,
    variantColor: isVariant
      ? product.variants?.[variantIndex]?.colorId?.colorName || null
      : product.colorId?.colorName || null,
    secondaryColor: isVariant
      ? product.variants?.[variantIndex]?.secondaryColorId?.colorName || null
      : product.secondaryColorId?.colorName || null,
    colorLabel: colorLabel || null,
    displayPrice: priceInfo.displayPrice,
    originalPrice: priceInfo.originalPrice,
    hasDiscount: priceInfo.hasDiscount,
    totalItemPrice: priceInfo.totalPrice,
    addedAt: item.addedAt,
  };
  if (isVariant) formatted.variantIndex = variantIndex;
  return formatted;
};

export const getCartItemInfoForOrder = (product, item) => {
  const productType = item.productType || product?.productType;
  const variantIndex = item.variantIndex;

  // Return the original fields from the product model
  const price = Number(product?.price) || 0;
  const discount = Number(product?.discount) || 0;
  const discountPrice = product?.discountPrice;

  return {
    price,
    discount,
    discountPrice,
    productName: getProductDisplayName(product, productType, variantIndex),
    colorName: getColorLabel(product, productType, variantIndex),
    imageUrl: getImageUrl(product, productType, variantIndex),
  };
};

//------------------------------------- Cart Item Matching -------------------------------------------------

export const findCartItemIndex = (items, productId, variantIndex) => {
  const target = parseVariantIndex(variantIndex);
  return items.findIndex((item) => {
    const matchProduct =
      String(item.productId?._id || item.productId) === String(productId);
    const itemV = item.variantIndex ?? null;
    return matchProduct && itemV === target;
  });
};

export const itemMatchesCartItem = (item, productId, variantIndex) => {
  const target = parseVariantIndex(variantIndex);
  const matchProduct =
    String(item.productId?._id || item.productId) === String(productId);
  const itemV = item.variantIndex ?? null;
  return matchProduct && itemV === target;
};
