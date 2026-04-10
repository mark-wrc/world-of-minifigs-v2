import Bundle from "../../../models/bundle.model.js";
import DealerAddon from "../../../models/dealerAddon.model.js";
import DealerExtraBag from "../../../models/dealerExtraBag.model.js";
import DealerTorsoBag from "../../../models/dealerTorsoBag.model.js";
import GeneralInventory from "../../../models/generalInventory.model.js";
import {
  buildStripeLineItem,
  decrementDealerAddonStock,
} from "../../../utils/payment/index.js";
import {
  createOrderRecord,
  saveOrderDraft,
  getDraftAndClean,
} from "../paymentCore.js";
import { EXTRA_BAG_RATIO } from "../paymentConfig.js";
import { ORDER_TYPES } from "../../../constants/orderConstants.js";

// ------------ Build Stripe Line Items for Dealer Checkout ------------

export async function buildLineItemsForDealer(body, userId) {
  const { bundleId, torsoBags: torsoBagsPayload, addons, extraBags } = body;

  // 1. Validate & fetch bundle
  if (!bundleId) {
    return {
      error: {
        status: 400,
        message: "Bundle is required",
        description: "Please select a minifig bundle.",
      },
    };
  }

  const bundle = await Bundle.findOne({
    _id: bundleId,
    bundleType: "dealer",
    isActive: true,
  }).lean();

  if (!bundle) {
    return {
      error: {
        status: 404,
        message: "Bundle not found",
        description: "The selected bundle does not exist or is unavailable.",
      },
    };
  }

  // 2. Validate & fetch torso bags
  const validatedTorsoBags = [];
  if (Array.isArray(torsoBagsPayload) && torsoBagsPayload.length > 0) {
    for (const entry of torsoBagsPayload) {
      const qty = Math.max(1, Math.floor(Number(entry.quantity) || 1));
      const bag = await DealerTorsoBag.findOne({
        _id: entry.torsoBagId,
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

      validatedTorsoBags.push({
        torsoBagId: bag._id,
        bagName: bag.bagName,
        quantity: qty,
      });
    }
  }

  // 3. Validate & fetch addons
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
          select: "minifigName price stock",
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

          const totalNeeded = bundleItem.quantityPerBag * bagsRequested;
          if (totalNeeded > (inventory.stock || 0)) {
            return {
              error: {
                status: 400,
                message: "Insufficient stock",
                description: `"${inventory.minifigName}" requires ${totalNeeded} items, but only ${inventory.stock} in stock.`,
              },
            };
          }

          const itemBagPrice =
            bundleItem.pricePerBag ||
            (inventory.price || 0) * bundleItem.quantityPerBag;
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

  // 4. Validate & fetch extra bags
  const validatedExtraBags = [];
  let extraBagsTotal = 0;
  if (extraBags && Array.isArray(extraBags) && extraBags.length > 0) {
    const maxBags = Math.floor(bundle.minifigQuantity / EXTRA_BAG_RATIO);
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

  // 5. Build Stripe line items
  const bagSummary = validatedTorsoBags
    .map((tb) =>
      tb.quantity > 1 ? `${tb.bagName}×${tb.quantity}` : tb.bagName,
    )
    .join(", ");
  const bundleName = `${bundle.minifigQuantity} Minifigs${bagSummary ? ` [${bagSummary}]` : ""}`;

  const lineItems = [
    buildStripeLineItem(bundleName, Math.round(bundle.totalPrice * 100), 1),
  ];

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

  // 6. Save Draft Snapshot (Scalability & Character Limit Solution)
  const draftId = await saveOrderDraft(userId, ORDER_TYPES.DEALER, {
    bundleId: bundle._id,
    torsoBags: validatedTorsoBags.length > 0 ? validatedTorsoBags : undefined,
    addons: validatedAddons,
    extraBags: validatedExtraBags,
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

  const { bundleId, torsoBags, addons, extraBags } = draft.payload;

  const bundle = await Bundle.findById(bundleId).lean();
  if (!bundle) return null;

  // Build the hierarchical manifest for database persistence
  const manifest = {
    bundle: {
      id: bundle._id,
      name: `${bundle.minifigQuantity} Minifigs`,
      price: bundle.totalPrice,
    },
  };

  if (torsoBags?.length > 0) {
    const resolvedBags = [];
    for (const { torsoBagId, bagName, quantity } of torsoBags) {
      const bag = await DealerTorsoBag.findById(torsoBagId).lean();
      resolvedBags.push({
        id: bag?._id || torsoBagId,
        name: bag?.bagName || bagName,
        quantity,
      });
    }
    manifest.torsoBags = resolvedBags;

    // Backward-compat: populate legacy torsoBag field with first entry
    if (resolvedBags.length > 0) {
      const first = resolvedBags[0];
      const firstBag = await DealerTorsoBag.findById(first.id).lean();
      if (firstBag) {
        const multiplier =
          bundle.torsoBagType === "custom"
            ? 1
            : Math.round(
                bundle.minifigQuantity / (firstBag.targetBundleSize || 100),
              );
        manifest.torsoBag = {
          id: firstBag._id,
          name: firstBag.bagName,
          multiplier,
        };
      }
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
            const bundleItem = addonBase.bundleItems?.find(
              (bi) =>
                bi.inventoryItemId?.toString() ===
                sub.inventoryItemId?.toString(),
            );
            const pricePerBag = bundleItem?.pricePerBag || 0;
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
    }));
  }

  const result = await createOrderRecord(session, {
    orderType: ORDER_TYPES.DEALER,
    items: manifest,
  });

  if (result?.created && addons?.length > 0) {
    // Note: Stock manager expects a specific ID/qty/items format
    await decrementDealerAddonStock(
      addons.map((a) => ({
        id: a.addonId,
        qty: 1,
        items: a.selectedItems,
      })),
    );
  }

  return result;
}
