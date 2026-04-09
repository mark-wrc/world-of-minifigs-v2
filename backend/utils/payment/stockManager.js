import Product from "../../models/product.model.js";
import GeneralInventory from "../../models/generalInventory.model.js";
import DealerAddon from "../../models/dealerAddon.model.js";

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

      // Need the definition to know quantityPerBag
      const definition = addon.bundleItems.find(
        (bi) => bi.inventoryItemId?._id?.toString() === invId.toString(),
      );
      if (!definition) continue;

      const totalNeeded = definition.quantityPerBag * bags * addonQty;
      await GeneralInventory.findByIdAndUpdate(invId, {
        $inc: { stock: -totalNeeded },
      });
    }
  }
};

const restockDealerAddonItems = async (dealerItems) => {
  const addons = dealerItems?.addons || dealerItems?.selectedAddons; // Handle manifest vs details
  if (!addons?.length) return;

  for (const addonEntry of addons) {
    // Note: The new manifest uses 'id' instead of 'addonId' and 'subItems' instead of 'selectedItems'
    const addonId = addonEntry.id || addonEntry.addonId;
    const quantity = Number(addonEntry.quantity) || 1;
    const subItems = addonEntry.subItems || addonEntry.selectedItems;

    const addon = await DealerAddon.findById(addonId).lean();
    if (!addon || addon.addonType !== "bundle") continue;

    const itemsToProcess =
      subItems && Array.isArray(subItems)
        ? subItems
        : (addon.bundleItems || []).map((bi) => ({
            invId: bi.inventoryItemId,
            qty: 1, // Fallback
          }));

    for (const selItem of itemsToProcess) {
      // Handle invId (new) vs inventoryItemId (old)
      const invId =
        selItem.invId?._id || selItem.invId || selItem.inventoryItemId;
      if (!invId) continue;

      // Handle qty (new) vs selectedBags (old)
      const bags = Number(selItem.qty || selItem.selectedBags || 0);
      if (bags === 0) continue;

      const definition = addon.bundleItems.find(
        (bi) => bi.inventoryItemId?._id?.toString() === invId.toString(),
      );
      if (!definition) continue;

      const totalIncrement = definition.quantityPerBag * bags * quantity;
      await GeneralInventory.findByIdAndUpdate(invId, {
        $inc: { stock: totalIncrement },
      });
    }
  }
};

// ------------------------- Generic Restock Dispatcher -----------------------------

export const restockOrder = async (order) => {
  if (order.orderType === "dealer") {
    await restockDealerAddonItems(order.dealerItems || order.dealerDetails);
  } else {
    await incrementProductStockForItems(order.productItems || order.items);
  }
};
