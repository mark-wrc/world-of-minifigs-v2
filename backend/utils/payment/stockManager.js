import Product from "../../models/product.model.js";
import GeneralInventory from "../../models/generalInventory.model.js";
import DealerAddon from "../../models/dealerAddon.model.js";
import DealerTorsoBag from "../../models/dealerTorsoBag.model.js";

// ------------------------- Safe Decrement Helper --------------------------------
//
// Atomically subtracts `qty` from a numeric field, never letting it go below 0.
// Webhooks fire after payment is captured, so if stock has been drained by a
// concurrent order between checkout and webhook we can't refuse the order —
// but we must not corrupt the inventory by writing a negative value.
//
// Strategy: a guarded $inc that only fires when at least `qty` is available.
// If the guard fails, atomically clamp the field to 0 and log the oversell so
// admins are alerted to fulfil/refund it manually.

const getNestedValue = (doc, path) =>
  path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), doc);

const safeDecrement = async (Model, id, fieldPath, qty) => {
  if (!id || !(qty > 0)) return { ok: true };

  const guarded = await Model.findOneAndUpdate(
    { _id: id, [fieldPath]: { $gte: qty } },
    { $inc: { [fieldPath]: -qty } },
  );
  if (guarded) return { ok: true };

  // Oversold: take what's left and clamp to 0.
  const before = await Model.findOneAndUpdate(
    { _id: id, [fieldPath]: { $gt: 0 } },
    { $set: { [fieldPath]: 0 } },
  );
  const available = Number(getNestedValue(before, fieldPath)) || 0;
  const oversoldBy = qty - available;

  console.error(
    `[stock] oversold ${Model.modelName} ${id} (${fieldPath}): available=${available}, requested=${qty}, oversoldBy=${oversoldBy}`,
  );
  return { ok: false, oversoldBy };
};

// ------------------------- Product Stock Management --------------------------------

const decrementStockForItem = async (productId, variantIndex, quantity) => {
  const qty = Number(quantity) || 1;
  const id = productId?._id ?? productId;
  if (!id) return;

  const fieldPath =
    variantIndex != null ? `variants.${variantIndex}.stock` : "stock";
  await safeDecrement(Product, id, fieldPath, qty);
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
      await safeDecrement(GeneralInventory, invId, "stock", totalBags);
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
    await safeDecrement(DealerTorsoBag, id, "stock", qty);
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
