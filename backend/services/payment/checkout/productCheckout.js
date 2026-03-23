import Cart from "../../../models/cart.model.js";
import Product from "../../../models/product.model.js";
import {
  CART_POPULATE_ORDER,
  CART_POPULATE_CHECKOUT,
  POPULATE_COLORS_NAMES_ONLY,
} from "../../../utils/populateHelpers.js";
import {
  computeUnitPrice,
  buildStripeLineItem,
  buildOrderItem,
  decrementProductStock,
  decrementProductStockForItems,
} from "../../../utils/payment/index.js";
import {
  getCartItemInfoForOrder,
  parseVariantIndex,
} from "../../../utils/productItemUtils.js";
import {
  createOrderRecord,
  saveOrderDraft,
  getDraftAndClean,
} from "../paymentCore.js";
import { ORDER_TYPES } from "../../../constants/orderConstants.js";

// -------------------- Build Order Items from Cart ------------------------

export async function buildOrderFromCart(cart) {
  const orderItems = [];
  for (const item of cart.items) {
    const product = item.productId;
    if (!product) continue;

    const { price, discount, discountPrice, productName, imageUrl } =
      getCartItemInfoForOrder(product, item);
    const unitPrice = computeUnitPrice(price, discount, discountPrice);

    orderItems.push(
      buildOrderItem({
        productId: product._id,
        productName,
        variantIndex: item.variantIndex,
        quantity: Number(item.quantity) || 1,
        unitPrice,
        basePrice: price,
        discount,
        imageUrl,
      }),
    );
  }
  return orderItems;
}

// ------------ Build Order Items from Direct (Buy Now) Metadata -----------

export async function buildOrderFromDirectMetadata(metadata) {
  const productId = metadata?.productId;
  const variantIndex = parseVariantIndex(metadata?.variantIndex);
  const quantity = Number(metadata?.quantity) || 1;

  if (!productId) return null;

  const product = await Product.findById(productId)
    .populate(POPULATE_COLORS_NAMES_ONLY)
    .lean();

  if (!product) return null;

  const item = { productType: product.productType, variantIndex, quantity };
  const { price, discount, discountPrice, productName, imageUrl } =
    getCartItemInfoForOrder(product, item);
  const unitPrice = computeUnitPrice(price, discount, discountPrice);

  return [
    buildOrderItem({
      productId: product._id,
      productName,
      variantIndex,
      quantity,
      unitPrice,
      basePrice: price,
      discount,
      imageUrl,
    }),
  ];
}

// ------------ Create Order from Stripe Session ------------

export async function createOrderFromStripeSession(session) {
  const meta = session.metadata || {};
  const orderType = meta.orderType || ORDER_TYPES.PRODUCT;
  if (orderType !== ORDER_TYPES.PRODUCT) return null;

  const draft = await getDraftAndClean(meta.draftId);
  if (!draft) {
    console.error(
      "createOrderFromStripeSession: draft not found",
      meta.draftId,
    );
    return null;
  }

  const userId = session.client_reference_id;
  const { source, payload } = draft.payload || {};
  const isDirect = source === "direct";

  let orderItems = [];
  if (isDirect) {
    // For direct, payload is { productId, variantIndex, quantity }
    orderItems = await buildOrderFromDirectMetadata(payload);
  } else {
    // For cart, payload is the array of cart items [ { productId, variantIndex, quantity, ... } ]
    // We already have the snapshot in payload.items
    const cartSnapshot = { items: payload.items || [] };
    orderItems = await buildOrderFromCart(cartSnapshot);
  }

  if (!orderItems?.length) {
    console.error(
      "createOrderFromStripeSession: no valid items in draft",
      draft._id,
    );
    return null;
  }

  const result = await createOrderRecord(session, {
    orderType: ORDER_TYPES.PRODUCT,
    items: orderItems,
  });

  if (!result?.created) return result;

  // Decrease stock based on the SNAPSHOT items we actually used
  const stockItems = orderItems.map((o) => ({
    productId: o.productId,
    variantIndex: o.variantIndex,
    quantity: o.quantity,
  }));
  await decrementProductStockForItems(stockItems);

  // If it was a cart checkout, clean up the user's cart (which might have changed, but this checkout is done)
  if (!isDirect) {
    await Cart.findOneAndDelete({ userId });
  }

  return result;
}

// ------------ Build Stripe Line Items for Direct Checkout ------------

export async function buildLineItemsForDirectProduct(body, userId) {
  const { productId, variantIndex: rawVariantIndex, quantity } = body;

  if (!productId) {
    return {
      error: {
        status: 400,
        message: "Product is required",
        description: "Please select a product to checkout.",
      },
    };
  }

  const product = await Product.findById(productId)
    .populate(POPULATE_COLORS_NAMES_ONLY)
    .lean();

  if (!product) {
    return {
      error: {
        status: 404,
        message: "Product not found",
        description: "The selected product does not exist.",
      },
    };
  }

  if (!product.isActive) {
    return {
      error: {
        status: 400,
        message: "Product unavailable",
        description: "This product is not available for purchase.",
      },
    };
  }

  const isVariant = product.productType === "variant";
  const variantIndex = parseVariantIndex(rawVariantIndex);

  if (isVariant && variantIndex === null) {
    return {
      error: {
        status: 400,
        message: "Variant required",
        description: "Please select a color or variant before checkout.",
      },
    };
  }

  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const variant = isVariant ? product.variants?.[variantIndex] : null;
  const stock = isVariant ? (variant?.stock ?? 0) : (product.stock ?? 0);

  if (stock < qty) {
    return {
      error: {
        status: 400,
        message: "Insufficient stock",
        description: "Not enough stock available for this item.",
      },
    };
  }

  const item = {
    productType: product.productType,
    variantIndex: isVariant ? variantIndex : null,
    quantity: qty,
  };
  const { price, discount, discountPrice, productName, imageUrl } =
    getCartItemInfoForOrder(product, item);
  const unitPrice = computeUnitPrice(price, discount, discountPrice);

  // Save draft for direct checkout
  const draftId = await saveOrderDraft(userId, ORDER_TYPES.PRODUCT, {
    source: "direct",
    payload: {
      productId,
      variantIndex,
      quantity: qty,
    },
  });

  return {
    lineItems: [
      buildStripeLineItem(
        productName,
        Math.round(unitPrice * 100),
        qty,
        imageUrl,
      ),
    ],
    metadata: {
      orderType: ORDER_TYPES.PRODUCT,
      draftId,
    },
  };
}

// ------------ Build Stripe Line Items from Cart ------------

export async function buildCartLineItems(userId) {
  const cart = await Cart.findOne({ userId }).populate(CART_POPULATE_CHECKOUT);

  if (!cart?.items?.length) {
    return {
      error: {
        status: 400,
        message: "Cart is empty",
        description: "Add items to your cart before checkout.",
      },
    };
  }

  const lineItems = [];
  for (const item of cart.items) {
    const product = item.productId;
    if (!product?.isActive) continue;

    const { price, discount, discountPrice, productName, imageUrl } =
      getCartItemInfoForOrder(product, item);
    const unitPrice = computeUnitPrice(price, discount, discountPrice);

    lineItems.push(
      buildStripeLineItem(
        productName,
        Math.round(unitPrice * 100),
        Number(item.quantity) || 1,
        imageUrl,
      ),
    );
  }

  if (!lineItems.length) {
    return {
      error: {
        status: 400,
        message: "No valid items in cart",
        description: "Some items may be unavailable. Please update your cart.",
      },
    };
  }

  // Save draft for cart checkout
  const draftId = await saveOrderDraft(userId, ORDER_TYPES.PRODUCT, {
    source: "cart",
    payload: {
      items: cart.items, // Snapshot of current cart
    },
  });

  return {
    lineItems,
    metadata: {
      orderType: ORDER_TYPES.PRODUCT,
      draftId,
    },
  };
}
