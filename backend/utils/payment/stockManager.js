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
    if (!addon) continue;

    // Upgrade add-ons deplete their own finite stock (when tracked).
    if (addon.addonType === "upgrade") {
      if (addon.stock !== null && addon.stock !== undefined) {
        await safeDecrement(DealerAddon, id, "stock", addonQty);
      }
      continue;
    }

    if (addon.addonType !== "bundle") continue;

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
    if (!addon) continue;

    // Restore upgrade add-on stock (when tracked) on cancellation/refund.
    if (addon.addonType === "upgrade") {
      if (addon.stock !== null && addon.stock !== undefined) {
        await DealerAddon.findByIdAndUpdate(addonId, {
          $inc: { stock: quantity },
        });
      }
      continue;
    }

    if (addon.addonType !== "bundle") continue;

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
  // Multi-bundle orders nest torso bags under each bundle; legacy orders keep
  // a flat dealerItems.torsoBags array.
  const fromBundles = (dealerItems?.bundles || []).flatMap(
    (b) => b.torsoBags || [],
  );
  const torsoBags = fromBundles.length > 0 ? fromBundles : dealerItems?.torsoBags;
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

// ------------------------- Restock Single Order Lines -----------------------------
// For refunds: puts some of one order line back in stock. Lines are addressed by
// their key from shared/orderLines.js (p0, b0t1, a0s0, a0, …). Returns where the
// stock lives, or null when the website keeps no stock for that line (bundles
// without torso bags, extra bags, untracked add-ons).

const LINE_KEY = /^(?:p(\d+)|b(\d+)t(\d+)|t(\d+)|a(\d+)s(\d+)|a(\d+))$/;

export const getLineStockTarget = async (order, lineKey) => {
  const m = LINE_KEY.exec(lineKey || "");
  if (!m) return null;
  const [, p, bi, bt, t, ai, as, a] = m;
  const di = order.dealerItems || {};
  const idOf = (v) => v?._id ?? v;

  if (p != null) {
    const item = order.productItems?.[+p];
    const id = idOf(item?.productId);
    if (!id) return null;
    const field =
      item.variantIndex != null ? `variants.${item.variantIndex}.stock` : "stock";
    return { Model: Product, id, field };
  }
  if (bi != null || t != null) {
    const bag = bi != null ? di.bundles?.[+bi]?.torsoBags?.[+bt] : di.torsoBags?.[+t];
    const id = idOf(bag?.id);
    return id ? { Model: DealerTorsoBag, id, field: "stock" } : null;
  }
  const addon = di.addons?.[+(ai ?? a)];
  const addonId = idOf(addon?.id);
  if (!addonId) return null;
  const doc = await DealerAddon.findById(addonId).lean();
  if (!doc) return null;
  if (ai != null) {
    const invId = idOf(addon.subItems?.[+as]?.invId);
    return doc.addonType === "bundle" && invId
      ? { Model: GeneralInventory, id: invId, field: "stock" }
      : null;
  }
  return doc.addonType === "upgrade" && doc.stock !== null && doc.stock !== undefined
    ? { Model: DealerAddon, id: addonId, field: "stock" }
    : null;
};

// lines: [{ lineKey, quantity }]. Adds each quantity back to its stock.
export const restockOrderLines = async (order, lines) => {
  for (const { lineKey, quantity } of lines) {
    const qty = Number(quantity) || 0;
    if (qty <= 0) continue;
    const target = await getLineStockTarget(order, lineKey);
    if (!target) continue;
    await target.Model.findByIdAndUpdate(target.id, {
      $inc: { [target.field]: qty },
    });
  }
};

// ------------------------- Generic Restock Dispatcher -----------------------------

export const restockOrder = async (order) => {
  if (order.orderType === "dealer" || order.orderType === "wholesale") {
    await restockDealerAddonItems(order.dealerItems);
    await restockTorsoBagItems(order.dealerItems);
  } else {
    await incrementProductStockForItems(order.productItems);
  }
};
