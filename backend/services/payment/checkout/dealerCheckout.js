import Bundle from "../../../models/bundle.model.js";
import DealerAddon from "../../../models/dealerAddon.model.js";
import DealerExtraBag from "../../../models/dealerExtraBag.model.js";
import DealerTorsoBag from "../../../models/dealerTorsoBag.model.js";
import GeneralInventory from "../../../models/generalInventory.model.js";
import {
  buildStripeLineItem,
  decrementDealerAddonStock,
  decrementTorsoBagStock,
} from "../../../utils/payment/index.js";
import {
  createOrderRecord,
  saveOrderDraft,
  getDraftAndClean,
} from "../paymentCore.js";
import { EXTRA_BAG_RATIO, SHIPPING_INSURANCE_RATE } from "../paymentConfig.js";
import { ORDER_TYPES } from "../../../constants/orderConstants.js";

// Dealers may order multiple copies of the same bundle (e.g. 3× the 1000
// bundle = 3000 minifigs). Hard-capped — to go higher they pick a bigger bundle.
const MAX_BUNDLE_QUANTITY = 4;

const clampBundleQuantity = (value) =>
  Math.max(1, Math.min(MAX_BUNDLE_QUANTITY, Math.floor(Number(value) || 1)));

// ------------ Build Stripe Line Items for Dealer Checkout ------------

export async function buildLineItemsForDealer(body, userId) {
  const { bundles: bundlesPayload, addons, extraBags } = body;

  // 1. Validate bundles. Dealers may order several distinct bundles
  //    (e.g. 1000 + 200), each with its own copy quantity (1-4) and its own
  //    torso-bag split. Bundles are optional — add-ons / extra bags can stand alone.
  const validatedBundles = [];
  const torsoStock = {}; // torsoBagId -> available stock
  const torsoNeeded = {}; // torsoBagId -> total qty needed across all bundles
  const torsoName = {}; // torsoBagId -> bag name (for error messages)
  let largestBundleMinifigs = 0; // biggest bundle's minifig count — extra-bag cap

  if (Array.isArray(bundlesPayload) && bundlesPayload.length > 0) {
    for (const entry of bundlesPayload) {
      const bundle = await Bundle.findOne({
        _id: entry.bundleId,
        bundleType: "dealer",
        isActive: true,
      }).lean();

      if (!bundle) {
        return {
          error: {
            status: 404,
            message: "Bundle not found",
            description:
              "One of the selected bundles does not exist or is unavailable.",
          },
        };
      }

      const quantity = clampBundleQuantity(entry.quantity);

      // Validate this bundle's torso bags. The torso split already spans the
      // full slot count (per-copy bags × copy quantity), so quantities arrive
      // pre-scaled — no further multiplication here.
      const torsoBags = [];
      if (Array.isArray(entry.torsoBags) && entry.torsoBags.length > 0) {
        for (const tb of entry.torsoBags) {
          const qty = Math.max(1, Math.floor(Number(tb.quantity) || 1));

          const bag = await DealerTorsoBag.findOne({
            _id: tb.torsoBagId,
            isActive: true,
          }).lean();

          if (!bag) {
            return {
              error: {
                status: 404,
                message: "Torso bag not found",
                description:
                  "One of the selected torso bags does not exist or is unavailable.",
              },
            };
          }

          const key = bag._id.toString();
          torsoStock[key] = bag.stock ?? 0;
          torsoNeeded[key] = (torsoNeeded[key] || 0) + qty;
          torsoName[key] = bag.bagName;

          torsoBags.push({
            torsoBagId: bag._id,
            bagName: bag.bagName,
            quantity: qty,
          });
        }
      }

      validatedBundles.push({ bundle, quantity, torsoBags });
      largestBundleMinifigs = Math.max(
        largestBundleMinifigs,
        bundle.minifigQuantity,
      );
    }

    // Aggregate stock check — the same torso bag may be used by more than
    // one selected bundle, so validate the combined demand.
    for (const key of Object.keys(torsoNeeded)) {
      if ((torsoStock[key] || 0) < torsoNeeded[key]) {
        return {
          error: {
            status: 400,
            message: "Torso bag out of stock",
            description: `"${torsoName[key]}" does not have enough stock to fulfill this order.`,
          },
        };
      }
    }
  }

  // 2. Validate & fetch addons
  const validatedAddons = [];
  let addonsTotal = 0;
  if (addons && Array.isArray(addons) && addons.length > 0) {
    for (const addonEntry of addons) {
      const { addonId, selectedItems } = addonEntry;

      const addon = await DealerAddon.findOne({
        _id: addonId,
        isActive: true,
      })
        .populate({
          path: "bundleItems.inventoryItemId",
          select: "minifigName pricePerBag piecesPerBag stock category",
        })
        .lean();

      if (!addon) continue;

      // For upgrade addons use discountPrice if set, otherwise original price
      const upgradePrice =
        addon.addonType === "upgrade" &&
        addon.discountPrice !== null &&
        addon.discountPrice !== undefined
          ? addon.discountPrice
          : addon.price || 0;

      let finalPrice = upgradePrice;
      const finalItems = [];

      if (addon.addonType === "bundle" && selectedItems) {
        finalPrice = 0;

        for (const selItem of selectedItems) {
          const bundleItem = addon.bundleItems.find(
            (bi) =>
              bi.inventoryItemId?._id?.toString() === selItem.inventoryItemId,
          );
          if (!bundleItem) continue;

          const inventory = bundleItem.inventoryItemId;
          if (!inventory) continue;

          const bagsRequested = Math.max(0, Number(selItem.selectedBags) || 0);
          if (bagsRequested === 0) continue;

          if (bagsRequested > (inventory.stock || 0)) {
            return {
              error: {
                status: 400,
                message: "Insufficient stock",
                description: `"${inventory.minifigName}" requires ${bagsRequested} bag${bagsRequested === 1 ? "" : "s"}, but only ${inventory.stock} in stock.`,
              },
            };
          }

          const itemBagPrice = Number(inventory.pricePerBag || 0);
          finalPrice += itemBagPrice * bagsRequested;
          finalItems.push({
            inventoryItemId: selItem.inventoryItemId,
            selectedBags: bagsRequested,
          });
        }
      }

      addonsTotal += finalPrice;
      validatedAddons.push({
        addonId: addon._id.toString(),
        addonName: addon.addonName,
        addonType: addon.addonType,
        selectedItems: finalItems,
        totalPrice: finalPrice,
      });
    }
  }

  // 3. Validate & fetch extra bags. Extra-bag cap only applies when at least
  //    one bundle is selected; it is based on the single largest bundle, not
  //    the sum of bundles or copy quantities.
  const validatedExtraBags = [];
  let extraBagsTotal = 0;
  if (extraBags && Array.isArray(extraBags) && extraBags.length > 0) {
    if (validatedBundles.length > 0) {
      const maxBags = Math.floor(largestBundleMinifigs / EXTRA_BAG_RATIO);
      const totalSelected = extraBags.reduce(
        (sum, eb) => sum + Math.max(1, Math.floor(Number(eb.quantity) || 1)),
        0,
      );

      if (totalSelected > maxBags) {
        return {
          error: {
            status: 400,
            message: "Too many extra bags",
            description: `Allowed up to ${maxBags} extra bags. You selected ${totalSelected}.`,
          },
        };
      }
    }

    for (const bagEntry of extraBags) {
      const { extraBagId, quantity } = bagEntry;
      const qty = Math.max(1, Math.floor(Number(quantity) || 1));

      const extraBag = await DealerExtraBag.findOne({
        _id: extraBagId,
        isActive: true,
      })
        .populate("subCollectionId", "subCollectionName")
        .lean();

      const subName = extraBag.subCollectionId?.subCollectionName || "Bag";
      const bagName = `Extra ${subName}`;

      extraBagsTotal += extraBag.price * qty;
      validatedExtraBags.push({
        extraBagId: extraBag._id.toString(),
        bagName: bagName,
        quantity: qty,
        price: extraBag.price,
      });
    }
  }

  // 4. Require at least one purchasable item.
  if (
    validatedBundles.length === 0 &&
    validatedAddons.length === 0 &&
    validatedExtraBags.length === 0
  ) {
    return {
      error: {
        status: 400,
        message: "Empty order",
        description:
          "Please select a bundle, add-on, or extra part bag before checking out.",
      },
    };
  }

  // 5. Build Stripe line items — one per ordered bundle.
  const lineItems = [];
  let bundlesTotal = 0;

  validatedBundles.forEach((vb) => {
    const bagSummary = vb.torsoBags
      .map((tb) =>
        tb.quantity > 1 ? `${tb.bagName}×${tb.quantity}` : tb.bagName,
      )
      .join(", ");
    const bundleName = `${vb.bundle.minifigQuantity} Minifigs${
      vb.quantity > 1 ? ` × ${vb.quantity}` : ""
    }${bagSummary ? ` [${bagSummary}]` : ""}`;
    bundlesTotal += vb.bundle.totalPrice * vb.quantity;
    lineItems.push(
      buildStripeLineItem(
        bundleName,
        Math.round(vb.bundle.totalPrice * vb.quantity * 100),
        1,
      ),
    );
  });

  // Individual Add-ons
  if (validatedAddons.length > 0) {
    validatedAddons.forEach((addon) => {
      let addonName = addon.addonName;

      if (addon.addonType === "bundle") {
        const bagCount =
          addon.selectedItems?.reduce((s, i) => s + i.selectedBags, 0) || 0;
        const itemCount = addon.selectedItems?.length || 0;
        addonName += ` [${itemCount} Item${itemCount !== 1 ? "s" : ""} (${bagCount} Bag${bagCount !== 1 ? "s" : ""})]`;
      }

      lineItems.push(
        buildStripeLineItem(addonName, Math.round(addon.totalPrice * 100), 1),
      );
    });
  }

  // Individual Extra Bags
  if (validatedExtraBags.length > 0) {
    validatedExtraBags.forEach((bag) => {
      lineItems.push(
        buildStripeLineItem(
          bag.bagName,
          Math.round(bag.price * 100),
          bag.quantity,
        ),
      );
    });
  }

  // 6. Optional shipping insurance — 0.5% of the order subtotal.
  const orderSubtotal = bundlesTotal + addonsTotal + extraBagsTotal;
  const shippingInsurance =
    body.shippingInsurance === true
      ? Math.round(orderSubtotal * SHIPPING_INSURANCE_RATE * 100) / 100
      : 0;

  if (shippingInsurance > 0) {
    lineItems.push(
      buildStripeLineItem(
        "Shipping Insurance (0.5%)",
        Math.round(shippingInsurance * 100),
        1,
      ),
    );
  }

  // 7. Save Draft Snapshot (Scalability & Character Limit Solution)
  const draftId = await saveOrderDraft(userId, ORDER_TYPES.DEALER, {
    bundles: validatedBundles.map((vb) => ({
      bundleId: vb.bundle._id,
      quantity: vb.quantity,
      torsoBags: vb.torsoBags,
    })),
    addons: validatedAddons,
    extraBags: validatedExtraBags,
    shippingInsurance,
  });

  return {
    lineItems,
    metadata: {
      orderType: ORDER_TYPES.DEALER,
      draftId,
    },
  };
}

// ------------ Create Order from Dealer Stripe Session ------------

export async function createDealerOrderFromStripeSession(session) {
  const meta = session.metadata || {};
  const draft = await getDraftAndClean(meta.draftId);

  if (!draft) {
    console.error("createDealerOrder: draft not found", meta.draftId);
    return null;
  }

  const {
    bundles: bundlesDraft,
    addons,
    extraBags,
    shippingInsurance = 0,
  } = draft.payload;

  // Build the hierarchical manifest for database persistence
  const manifest = {};

  // Bundles are optional — dealers can order addons / extra bags alone.
  if (Array.isArray(bundlesDraft) && bundlesDraft.length > 0) {
    manifest.bundles = [];
    for (const b of bundlesDraft) {
      const bundle = await Bundle.findById(b.bundleId).lean();
      if (!bundle) continue;

      const quantity = clampBundleQuantity(b.quantity);
      manifest.bundles.push({
        id: bundle._id,
        name:
          quantity > 1
            ? `${bundle.minifigQuantity} Minifigs × ${quantity}`
            : `${bundle.minifigQuantity} Minifigs`,
        price: bundle.totalPrice * quantity,
        quantity,
        torsoBags: (b.torsoBags || []).map((tb) => ({
          id: tb.torsoBagId,
          name: tb.bagName,
          quantity: tb.quantity,
        })),
      });
    }
  }

  if (addons?.length > 0) {
    manifest.addons = [];
    for (const { addonId, totalPrice, selectedItems } of addons) {
      const addonBase = await DealerAddon.findById(addonId).lean();
      if (!addonBase) continue;

      const addonManifest = {
        id: addonBase._id,
        name: addonBase.addonName,
        type: addonBase.addonType,
        totalPrice: totalPrice,
        subItems: [],
      };

      if (selectedItems?.length > 0) {
        for (const sub of selectedItems) {
          const inv = await GeneralInventory.findById(sub.inventoryItemId)
            .populate("colorId", "colorName hexCode")
            .lean();
          if (inv) {
            const pricePerBag = Number(inv.pricePerBag || 0);
            addonManifest.subItems.push({
              invId: inv._id,
              name: inv.minifigName,
              qty: sub.selectedBags,
              imageUrl: inv.image?.url,
              colorName: inv.colorId?.colorName,
              colorHex: inv.colorId?.hexCode,
              pricePerBag,
              totalPrice: pricePerBag * (sub.selectedBags || 0),
            });
          }
        }
      }
      manifest.addons.push(addonManifest);
    }
  }

  if (extraBags?.length > 0) {
    manifest.extraBags = extraBags.map((eb) => ({
      id: eb.extraBagId,
      name: eb.bagName,
      quantity: eb.quantity,
      price: eb.price,
      totalPrice: eb.price * eb.quantity,
    }));
  }

  const result = await createOrderRecord(session, {
    orderType: ORDER_TYPES.DEALER,
    items: manifest,
    shippingInsurance,
  });

  if (result?.created) {
    // Decrement torso-bag stock across every ordered bundle.
    const allTorsoBags = (bundlesDraft || []).flatMap((b) => b.torsoBags || []);
    if (allTorsoBags.length > 0) {
      await decrementTorsoBagStock(allTorsoBags);
    }
    if (addons?.length > 0) {
      await decrementDealerAddonStock(
        addons.map((a) => ({
          id: a.addonId,
          qty: 1,
          items: a.selectedItems,
        })),
      );
    }
  }

  return result;
}
