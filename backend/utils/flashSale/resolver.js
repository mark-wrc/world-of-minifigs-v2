import FlashSale from "../../models/flashSale.model.js";

// Single source of truth for flash-sale pricing. Every read path (dealer add-on
// population, admin inventory list) and the checkout billing/snapshot call into
// here, so the discount math lives in exactly one place and can never drift.

// Effective price is clamped to this floor so a fixed discount can't drive a
// price to zero/negative. Mirrors the `min` on generalInventory.pricePerBag.
export const PRICE_FLOOR = 0.01;

// Round to 2 decimals without binary-float drift, so the displayed price and the
// Stripe integer-cents line item always agree.
export const round2 = (n) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Compute the discounted price for a base price + discount spec.
// Percentage discounts may reach $0.00 (100% off = free). Fixed $ discounts are
// floored at PRICE_FLOOR so they can never drive a price to zero/negative
// (their value is also validated to be < the price at write time).
export const computeSalePrice = (basePrice, discountType, discountValue) => {
  const base = Number(basePrice) || 0;
  const value = Number(discountValue) || 0;
  if (discountType === "percent") {
    return Math.max(round2(base * (1 - value / 100)), 0);
  }
  return Math.max(round2(base - value), PRICE_FLOOR);
};

// Derived status — always from the clock, never stored. `scheduled` (before the
// window), `active` (in-window + enabled), `paused` (in-window but disabled),
// `ended` (after the window).
export const getFlashSaleStatus = (sale, now = new Date()) => {
  const start = new Date(sale.startAt);
  const end = new Date(sale.endAt);
  if (now < start) return "scheduled";
  if (now > end) return "ended";
  return sale.isEnabled ? "active" : "paused";
};

// Build a Map<inventoryItemId(string) -> discount spec> for every item that is
// in a CURRENTLY-ACTIVE sale. Pass `inventoryIds` to scope the query to a known
// set (the common case); omit it to map every active sale.
export async function getActiveFlashSaleMap(inventoryIds = null, now = new Date()) {
  const query = {
    isEnabled: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
  };

  if (Array.isArray(inventoryIds) && inventoryIds.length > 0) {
    query["items.inventoryItemId"] = { $in: inventoryIds };
  }

  const sales = await FlashSale.find(query)
    .select("name endAt items")
    .lean();

  const map = new Map();
  for (const sale of sales) {
    for (const line of sale.items || []) {
      const id = String(line.inventoryItemId);
      const candidate = {
        discountType: line.discountType,
        discountValue: line.discountValue,
        endAt: sale.endAt,
        saleId: sale._id,
        saleName: sale.name,
      };
      const existing = map.get(id);
      if (!existing) {
        map.set(id, candidate);
        continue;
      }
      // Overlapping active sales for one item are prevented at write time, but
      // defend anyway: keep whichever discount is nominally larger and warn.
      console.warn(
        `[flashSale] item ${id} is in multiple active sales; picking the larger discount.`,
      );
      const score = (c) =>
        c.discountType === "percent" ? c.discountValue : c.discountValue;
      if (score(candidate) > score(existing)) map.set(id, candidate);
    }
  }
  return map;
}

// Given a (populated) inventory doc and the active-sale map, return the flash
// sale info for that item, or null when it isn't on sale. `salePrice` is
// computed from the item's CURRENT pricePerBag so a mid-sale price edit tracks.
export function getFlashSaleForItem(inventory, saleMap) {
  if (!inventory || !saleMap || saleMap.size === 0) return null;
  const id = String(inventory._id || inventory.inventoryItemId || "");
  const spec = saleMap.get(id);
  if (!spec) return null;

  const base = Number(inventory.pricePerBag) || 0;
  const salePrice = computeSalePrice(base, spec.discountType, spec.discountValue);
  // A discount that doesn't actually lower the price is treated as no sale.
  if (salePrice >= base) return null;

  return {
    salePrice,
    originalPrice: round2(base),
    discountType: spec.discountType,
    discountValue: spec.discountValue,
    endAt: spec.endAt,
    saleId: spec.saleId,
    saleName: spec.saleName,
  };
}

// Convenience for a single item lookup outside a batch (e.g. rarely-hit paths).
// Prefer getActiveFlashSaleMap + getFlashSaleForItem for lists.
export async function resolveEffectivePrice(inventory, now = new Date()) {
  const base = Number(inventory?.pricePerBag) || 0;
  if (!inventory?._id) return { effectivePrice: base, flashSale: null };
  const map = await getActiveFlashSaleMap([inventory._id], now);
  const flashSale = getFlashSaleForItem(inventory, map);
  return { effectivePrice: flashSale ? flashSale.salePrice : base, flashSale };
}
