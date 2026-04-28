import Product from "../../models/product.model.js";
import GeneralInventory from "../../models/generalInventory.model.js";
import DealerAddon from "../../models/dealerAddon.model.js";
import DealerTorsoBag from "../../models/dealerTorsoBag.model.js";

// ------------------------- Product Stock Management --------------------------------

const decrementStockForItem = async (productId, variantIndex, quantity) => {
  const qty = Number(quantity) || 1;
  const id = productId?._id ?? productId;
  if (!id) return;

  if (variantIndex != null) {
    await Product.findByIdAndUpdate(id, {
      $inc: { [`variants.${variantIndex}.stock`]: -qty },
    });
  } else {
    await Product.findByIdAndUpdate(id, {
      $inc: { stock: -qty },
    });
  }
};

const incrementStockForItem = async (productId, variantIndex, quantity) => {
  const qty = Number(quantity) || 1;
  const id = productId?._id ?? productId;
  if (!id) return;

  if (variantIndex != null) {
    await Product.findByIdAndUpdate(id, {
      $inc: { [`variants.${variantIndex}.stock`]: qty },
    });
  } else {
    await Product.findByIdAndUpdate(id, {
      $inc: { stock: qty },
    });
  }
};

export const decrementProductStock = async (cart) => {
  for (const item of cart.items) {
    const product = item.productId;
    if (!product) continue;
    await decrementStockForItem(
      product._id || product,
      item.variantIndex,
      item.quantity,
    );
  }
};

export const decrementProductStockForItems = async (items) => {
  for (const { productId, variantIndex, quantity } of items) {
    await decrementStockForItem(productId, variantIndex, quantity);
  }
};

const incrementProductStockForItems = async (items) => {
  if (!items || !Array.isArray(items)) return;

  for (const item of items) {
    await incrementStockForItem(
      item.productId,
      item.variantIndex,
      item.quantity,
    );
  }
};

// ------------------------- Dealer Stock Management --------------------------------

export const decrementDealerAddonStock = async (parsedAddons) => {
  for (const { id, qty, items } of parsedAddons) {
    const addonQty = Number(qty) || 1;
    const addon = await DealerAddon.findById(id).lean();

    if (!addon || addon.addonType !== "bundle") continue;

    // Use selected items if provided, otherwise fallback to whole bundle (for legacy/service)
    const itemsToProcess =
      items && Array.isArray(items)
        ? items
        : (addon.bundleItems || []).map((bi) => ({
            inventoryItemId: bi.inventoryItemId,
            selectedBags: 1, // Assume 1 per bag if no selection (fixed bundle)
          }));

    for (const selItem of itemsToProcess) {
      const invId = selItem.inventoryItemId?._id || selItem.inventoryItemId;
      if (!invId) continue;

      const bags = Number(selItem.selectedBags || 0);
      if (bags === 0) continue;

      const totalBags = bags * addonQty;
      await GeneralInventory.findByIdAndUpdate(invId, {
        $inc: { stock: -totalBags },
      });
    }
  }
};

const restockDealerAddonItems = async (dealerItems) => {
  const addons = dealerItems?.addons;
  if (!addons?.length) return;

  for (const addonEntry of addons) {
    const addonId = addonEntry.id;
    const quantity = Number(addonEntry.quantity) || 1;
    const subItems = addonEntry.subItems;

    const addon = await DealerAddon.findById(addonId).lean();
    if (!addon || addon.addonType !== "bundle") continue;

    if (!subItems?.length) continue;

    for (const selItem of subItems) {
      const invId = selItem.invId?._id ?? selItem.invId;
      if (!invId) continue;

      const bags = Number(selItem.qty || 0);
      if (bags === 0) continue;

      const totalBags = bags * quantity;
      await GeneralInventory.findByIdAndUpdate(invId, {
        $inc: { stock: totalBags },
      });
    }
  }
};

// ------------------------- Torso Bag Stock Management --------------------------------

export const decrementTorsoBagStock = async (torsoBags) => {
  if (!torsoBags || !Array.isArray(torsoBags)) return;
  for (const { torsoBagId, quantity } of torsoBags) {
    const id = torsoBagId?._id ?? torsoBagId;
    if (!id) continue;
    const qty = Number(quantity) || 1;
    await DealerTorsoBag.findByIdAndUpdate(id, {
      $inc: { stock: -qty },
    });
  }
};

const restockTorsoBagItems = async (dealerItems) => {
  const torsoBags = dealerItems?.torsoBags;
  if (!torsoBags?.length) return;
  for (const bag of torsoBags) {
    const id = bag.id?._id ?? bag.id;
    if (!id) continue;
    const qty = Number(bag.quantity) || 1;
    await DealerTorsoBag.findByIdAndUpdate(id, {
      $inc: { stock: qty },
    });
  }
};

// ------------------------- Generic Restock Dispatcher -----------------------------

export const restockOrder = async (order) => {
  if (order.orderType === "dealer") {
    await restockDealerAddonItems(order.dealerItems);
    await restockTorsoBagItems(order.dealerItems);
  } else {
    await incrementProductStockForItems(order.productItems);
  }
};
