import { useState, useMemo, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import {
  useGetDealerBundlesQuery,
  useGetDealerAddonsQuery,
  useGetDealerExtraBagsQuery,
  useGetDealerTorsoBagsQuery,
} from "@/redux/api/authApi";
import { sortByName } from "@/utils/formatting";
import { useCheckout } from "@/hooks/useCheckout";

// Dealers may order several distinct bundles in one order (e.g. 1000 + 200),
// each independently quantity-adjustable. Each bundle copy is capped — to go
// higher the dealer picks a bigger bundle.
const MAX_BUNDLE_QUANTITY = 4;

// Optional shipping insurance — 0.5% of the order subtotal.
const SHIPPING_INSURANCE_RATE = 0.005;

const clampBundleQuantity = (value) =>
  Math.max(1, Math.min(MAX_BUNDLE_QUANTITY, Math.floor(Number(value) || 1)));

export const useDealer = () => {
  const { user } = useSelector((state) => state.auth);
  const isAdmin = user?.role === "admin";

  // Multi-bundle selection state — all keyed by bundle id.
  const [selectedBundleIds, setSelectedBundleIds] = useState([]);
  const [bundleAutoSelected, setBundleAutoSelected] = useState(false);
  const [activeBundleId, setActiveBundleId] = useState(null); // bundle whose torso picker is shown
  const [bundleQuantities, setBundleQuantities] = useState({}); // { [bundleId]: 1-4 }
  const [torsoSplits, setTorsoSplits] = useState({}); // { [bundleId]: { [bagId]: qty } }
  const [lastClickedBag, setLastClickedBag] = useState({}); // { [bundleId]: bagId }

  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [selectedAddonConfigs, setSelectedAddonConfigs] = useState({});
  const [selectedAddon, setSelectedAddon] = useState(null);
  const [extraBagQuantities, setExtraBagQuantities] = useState({});

  // Optional shipping insurance opt-in (checkbox in the order summary).
  const [insuranceEnabled, setInsuranceEnabled] = useState(false);

  // ==================== Data Fetching ====================

  const {
    data: bundleData,
    isLoading: isLoadingBundles,
    isError: isErrorBundles,
  } = useGetDealerBundlesQuery();

  const {
    data: addonData,
    isLoading: isLoadingAddons,
    isError: isErrorAddons,
  } = useGetDealerAddonsQuery();

  const {
    data: extraBagData,
    isLoading: isLoadingExtraBags,
    isError: isErrorExtraBags,
  } = useGetDealerExtraBagsQuery();

  // Fetch every torso bag once; each bundle filters by its own base size.
  const {
    data: torsoBagData,
    isLoading: isLoadingTorsoBags,
    isError: isErrorTorsoBags,
  } = useGetDealerTorsoBagsQuery();

  const bundles = useMemo(
    () => (Array.isArray(bundleData?.bundles) ? bundleData.bundles : []),
    [bundleData],
  );
  const addons = useMemo(
    () => (Array.isArray(addonData?.addons) ? addonData.addons : []),
    [addonData],
  );
  const extraBags = useMemo(
    () =>
      Array.isArray(extraBagData?.extraBags) ? extraBagData.extraBags : [],
    [extraBagData],
  );

  const allTorsoBags = useMemo(
    () =>
      Array.isArray(torsoBagData?.torsoBags) ? torsoBagData.torsoBags : [],
    [torsoBagData],
  );

  // Total torso-bag slots for a bundle = per-copy bags × copy quantity.
  // (e.g. a 200 bundle = 2 bags; ordered ×3 → 6 customizable slots.)
  const slotsFor = useCallback(
    (bundle, quantity) =>
      (bundle.minifigQuantity / bundle.baseSize) * (quantity || 1),
    [],
  );

  // ==================== Bundle Selection ====================

  // Auto-select the 500-minifig bundle as a default on first load, falling
  // back to the first bundle. Runs once so the user stays in control after.
  useEffect(() => {
    if (bundleAutoSelected) return;
    if (bundles.length > 0) {
      const preferred =
        bundles.find((b) => b.minifigQuantity === 500) ?? bundles[0];
      setSelectedBundleIds([preferred._id]);
      setBundleQuantities({ [preferred._id]: 1 });
      setActiveBundleId(preferred._id);
      setBundleAutoSelected(true);
    }
  }, [bundles, bundleAutoSelected]);

  // Clicking a bundle card toggles its selection. Selecting a bundle also
  // focuses it so its torso picker shows immediately.
  const handleToggleBundle = useCallback(
    (bundleId) => {
      setBundleAutoSelected(true);

      if (selectedBundleIds.includes(bundleId)) {
        // Deselect — drop all of this bundle's state.
        const next = selectedBundleIds.filter((id) => id !== bundleId);
        setSelectedBundleIds(next);
        setBundleQuantities((prev) => {
          const { [bundleId]: _removed, ...rest } = prev;
          return rest;
        });
        setTorsoSplits((prev) => {
          const { [bundleId]: _removed, ...rest } = prev;
          return rest;
        });
        setLastClickedBag((prev) => {
          const { [bundleId]: _removed, ...rest } = prev;
          return rest;
        });
        // If the focused bundle was removed, focus another selected one.
        if (activeBundleId === bundleId) {
          setActiveBundleId(next[next.length - 1] || null);
        }
        return;
      }

      // Select a new bundle and focus it.
      setSelectedBundleIds([...selectedBundleIds, bundleId]);
      setBundleQuantities((prev) => ({ ...prev, [bundleId]: 1 }));
      setActiveBundleId(bundleId);
    },
    [selectedBundleIds, activeBundleId],
  );

  // Switch which selected bundle's torso picker is shown (tab strip).
  const handleSetActiveBundle = useCallback((bundleId) => {
    setActiveBundleId(bundleId);
  }, []);

  // Changing how many copies of a bundle are ordered re-sizes its torso-bag
  // split: extra slots top up the first assigned bag, removed slots are
  // trimmed from the largest bags.
  const handleBundleQtyChange = useCallback(
    (bundleId, newQty) => {
      const quantity = clampBundleQuantity(newQty);
      setBundleQuantities((prev) => ({ ...prev, [bundleId]: quantity }));

      const bundle = bundles.find((b) => b._id === bundleId);
      if (!bundle) return;
      const slots = slotsFor(bundle, quantity);

      setTorsoSplits((prev) => {
        const cur = prev[bundleId] || {};
        const total = Object.values(cur).reduce((sum, q) => sum + q, 0);
        if (total === slots) return prev;

        let nextSplit;
        if (total === 0) {
          const matching = allTorsoBags.filter(
            (b) => b.baseSize === bundle.baseSize,
          );
          if (matching.length === 0 || slots <= 0) return prev;
          nextSplit = { [matching[0]._id]: slots };
        } else if (total < slots) {
          // More copies — add the new slots to the first assigned bag.
          const firstId = Object.keys(cur).find((id) => cur[id] > 0);
          nextSplit = { ...cur, [firstId]: cur[firstId] + (slots - total) };
        } else {
          // Fewer copies — trim the excess, biggest bags first.
          let excess = total - slots;
          nextSplit = { ...cur };
          const entries = Object.entries(nextSplit).sort(
            ([, a], [, b]) => b - a,
          );
          for (const [id] of entries) {
            if (excess <= 0) break;
            const take = Math.min(nextSplit[id], excess);
            nextSplit[id] -= take;
            excess -= take;
            if (nextSplit[id] <= 0) delete nextSplit[id];
          }
        }
        return { ...prev, [bundleId]: nextSplit };
      });
    },
    [bundles, allTorsoBags, slotsFor],
  );

  // ==================== Torso Bag Auto-Assignment ====================

  // When a bundle has no torso split yet, assign every slot to its oldest
  // matching torso bag. The dealer can re-split afterwards.
  useEffect(() => {
    if (allTorsoBags.length === 0) return;
    setTorsoSplits((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const bundleId of selectedBundleIds) {
        const bundle = bundles.find((b) => b._id === bundleId);
        if (!bundle) continue;
        const existing = next[bundleId] || {};
        if (Object.values(existing).some((q) => q > 0)) continue;
        const slots = slotsFor(bundle, bundleQuantities[bundleId]);
        const matching = allTorsoBags.filter(
          (b) => b.baseSize === bundle.baseSize,
        );
        if (matching.length > 0 && slots > 0) {
          next[bundleId] = { [matching[0]._id]: slots };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedBundleIds, bundles, bundleQuantities, allTorsoBags, slotsFor]);

  // ==================== Torso Bag Handlers ====================

  const handleSelectTorsoBag = useCallback(
    (bundleId, bagId) => {
      // Always switch the preview to the clicked bag (for comparison browsing).
      setLastClickedBag((prev) => ({ ...prev, [bundleId]: bagId }));

      const bundle = bundles.find((b) => b._id === bundleId);
      if (!bundle) return;
      const bagMultiplier = slotsFor(bundle, bundleQuantities[bundleId]);

      setTorsoSplits((prev) => {
        const cur = prev[bundleId] || {};
        if ((cur[bagId] || 0) > 0) return prev; // already in order — just preview

        const usedByOthers = Object.entries(cur).reduce(
          (acc, [id, qty]) => (id === bagId ? acc : acc + qty),
          0,
        );

        let nextSplit;
        if (usedByOthers < bagMultiplier) {
          // Free slot available — just add.
          nextSplit = { ...cur, [bagId]: 1 };
        } else {
          // All slots taken — steal one from the bag with the highest qty.
          const donor = Object.entries(cur)
            .filter(([id]) => id !== bagId)
            .sort(([, a], [, b]) => b - a)[0];
          if (!donor) return prev;
          const [donorId, donorQty] = donor;
          nextSplit = { ...cur, [bagId]: 1 };
          if (donorQty - 1 > 0) {
            nextSplit[donorId] = donorQty - 1;
          } else {
            delete nextSplit[donorId];
          }
        }
        return { ...prev, [bundleId]: nextSplit };
      });
    },
    [bundles, bundleQuantities, slotsFor],
  );

  // Fine-grained quantity adjustment used by the order summary controls.
  const handleTorsoBagQtyChange = useCallback(
    (bundleId, bagId, newQty) => {
      const bundle = bundles.find((b) => b._id === bundleId);
      if (!bundle) return;
      const bagMultiplier = slotsFor(bundle, bundleQuantities[bundleId]);

      setTorsoSplits((prev) => {
        const cur = prev[bundleId] || {};
        const usedByOthers = Object.entries(cur).reduce(
          (acc, [id, qty]) => (id === bagId ? acc : acc + qty),
          0,
        );
        const clamped = Math.max(
          0,
          Math.min(newQty, bagMultiplier - usedByOthers),
        );
        let nextSplit;
        if (clamped === 0) {
          const { [bagId]: _removed, ...rest } = cur;
          nextSplit = rest;
        } else {
          nextSplit = { ...cur, [bagId]: clamped };
        }
        return { ...prev, [bundleId]: nextSplit };
      });
    },
    [bundles, bundleQuantities, slotsFor],
  );

  // ==================== Per-Bundle Sections ====================

  // One fully-derived section per selected bundle — drives the torso pickers
  // and the order summary.
  const bundleSections = useMemo(() => {
    return selectedBundleIds
      .map((bundleId) => {
        const bundle = bundles.find((b) => b._id === bundleId);
        if (!bundle) return null;

        const quantity = bundleQuantities[bundleId] || 1;
        // Total torso slots span every ordered copy of the bundle.
        const bagMultiplier = slotsFor(bundle, quantity);
        const split = torsoSplits[bundleId] || {};

        const sectionBags = allTorsoBags.filter(
          (b) => b.baseSize === bundle.baseSize,
        );
        const torsoBags = sectionBags.map((bag) => ({
          ...bag,
          isSelected: (split[bag._id] || 0) > 0,
          assignedQty: split[bag._id] || 0,
          firstImage: bag.items?.[0]?.image?.url,
        }));

        const totalAssignedBags = Object.values(split).reduce(
          (sum, qty) => sum + qty,
          0,
        );
        const remainingBagSlots = bagMultiplier - totalAssignedBags;

        // Pick the previewed bag — last clicked if still in the order,
        // otherwise the first assigned bag.
        const clickedId = lastClickedBag[bundleId];
        const assignedIds = Object.entries(split)
          .filter(([, qty]) => qty > 0)
          .map(([id]) => id);
        const previewId =
          clickedId && (split[clickedId] || 0) > 0
            ? clickedId
            : assignedIds[0] || null;
        const lastSelectedBag = previewId
          ? sectionBags.find((b) => b._id === previewId) || null
          : null;

        // Multiplier for the previewed bag = slots assigned to it.
        const previewQty = lastSelectedBag
          ? split[lastSelectedBag._id] || 0
          : 0;
        const multiplier = previewQty > 0 ? previewQty : bagMultiplier;

        const displayItems = lastSelectedBag?.items
          ? lastSelectedBag.items.map((item) => ({
              ...item,
              displayQuantity: item.quantity * multiplier,
            }))
          : [];

        // miscQuantity from the API is per single bundle copy. Scale it up by
        // copy quantity, then take the previewed bag's share of the slots.
        const miscQuantity =
          (bundle.miscQuantity ?? 0) *
          quantity *
          (multiplier / (bagMultiplier || 1));

        return {
          bundleId,
          bundle,
          quantity,
          bagMultiplier,
          torsoBags,
          totalAssignedBags,
          remainingBagSlots,
          lastSelectedBag,
          multiplier,
          displayItems,
          miscQuantity,
        };
      })
      .filter(Boolean);
  }, [
    selectedBundleIds,
    bundles,
    bundleQuantities,
    torsoSplits,
    lastClickedBag,
    allTorsoBags,
    slotsFor,
  ]);

  const hasSelectedBundles = bundleSections.length > 0;

  // The section whose torso picker is currently shown. Falls back to the
  // first selected bundle if the focused one is stale.
  const activeSection =
    bundleSections.find((s) => s.bundleId === activeBundleId) ||
    bundleSections[0] ||
    null;

  // Tab strip metadata — one entry per selected bundle.
  const bundleTabs = useMemo(
    () =>
      bundleSections.map((s) => ({
        bundleId: s.bundleId,
        bundleName: s.bundle.bundleName,
        isActive: s.bundleId === (activeSection?.bundleId ?? null),
        needsTorso: s.remainingBagSlots > 0,
      })),
    [bundleSections, activeSection],
  );

  // ==================== Computed Selections ====================

  const bundlesWithSelection = useMemo(() => {
    return bundles.map((bundle) => ({
      ...bundle,
      isSelected: selectedBundleIds.includes(bundle._id),
    }));
  }, [bundles, selectedBundleIds]);

  const addonsWithSelection = useMemo(() => {
    return addons.map((addon) => ({
      ...addon,
      isSelected: selectedAddonIds.includes(addon._id),
      hasItems:
        addon.addonType === "bundle" && (addon.bundleItems?.length || 0) > 0,
    }));
  }, [addons, selectedAddonIds]);

  // Extra bags are capped by the single largest bundle — not the sum of
  // bundles, and not affected by copy quantity. e.g. a 1000 bundle caps at 10
  // whether or not 200 bundles or extra copies are also ordered.
  const maxExtraBags = hasSelectedBundles
    ? bundleSections.reduce(
        (max, s) => Math.max(max, Math.floor(s.bundle.minifigQuantity / 100)),
        0,
      )
    : Infinity;

  const totalExtraBags = Object.values(extraBagQuantities).reduce(
    (acc, qty) => acc + qty,
    0,
  );

  const extraBagsWithComputed = useMemo(
    () =>
      extraBags.map((bag) => {
        const qty = extraBagQuantities[bag._id] || 0;
        const availableSlots = Math.max(0, maxExtraBags - totalExtraBags);
        return {
          ...bag,
          qty,
          total: (bag.price || 0) * qty,
          max: qty + availableSlots,
          canIncrease: totalExtraBags < maxExtraBags,
          canDecrease: qty > 0,
        };
      }),
    [extraBags, extraBagQuantities, totalExtraBags, maxExtraBags],
  );

  // ==================== Effects ====================

  // Reset extra bags if the cap shrinks below the current selection.
  useEffect(() => {
    if (totalExtraBags > maxExtraBags) {
      setExtraBagQuantities({});
    }
  }, [maxExtraBags, totalExtraBags]);

  // ==================== Addon Handlers ====================

  const handleToggleAddon = (addonId) => {
    setSelectedAddonIds((prev) => {
      if (prev.includes(addonId)) {
        setSelectedAddonConfigs((configs) => {
          const { [addonId]: _, ...rest } = configs;
          return rest;
        });
        return prev.filter((id) => id !== addonId);
      }
      return [...prev, addonId];
    });
  };

  const handleConfigureAddon = ({ addonId, price, selectedItems }) => {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId) ? prev : [...prev, addonId],
    );
    setSelectedAddonConfigs((prev) => ({
      ...prev,
      [addonId]: { addonId, price, selectedItems },
    }));
  };

  const handleExtraBagQtyChange = (bagId, newQty) => {
    setExtraBagQuantities((prev) => {
      const otherBagsQty = Object.entries(prev).reduce(
        (acc, [id, qty]) => (id === bagId ? acc : acc + qty),
        0,
      );
      if (otherBagsQty + newQty > maxExtraBags) return prev;
      return { ...prev, [bagId]: newQty };
    });
  };

  const handleToggleInsurance = useCallback((checked) => {
    setInsuranceEnabled(checked === true);
  }, []);

  // ==================== Addon Preview Modal ====================

  const modalItems = useMemo(() => {
    const items = selectedAddon?.bundleItems || [];
    return items
      .map((item, index) => {
        const inventory = item.inventoryItemId;
        if (!inventory?._id) return null;

        const perBagLimit = Number(inventory.piecesPerBag || 1);
        const maxBags = Number(inventory.stock || 0);

        return {
          key: `${inventory._id}-${index}`,
          inventoryItemId: inventory._id,
          itemName: inventory.minifigName,
          image: inventory.image,
          color: inventory.colorId,
          category: inventory.category,
          collectionId: inventory.collectionId,
          partType: inventory.partType || null,
          pricePerBag: Number(inventory.pricePerBag || 0),
          perBagLimit,
          maxBags,
        };
      })
      .filter(Boolean);
  }, [selectedAddon]);

  const [modalBagQuantities, setModalBagQuantities] = useState({});

  useEffect(() => {
    const config = selectedAddonConfigs[selectedAddon?._id];
    const savedItems =
      config?.addonId && config.addonId === selectedAddon?._id
        ? config.selectedItems
        : null;

    const quantities = modalItems.reduce((acc, item) => {
      const saved = savedItems?.find(
        (s) => s.inventoryItemId === item.inventoryItemId,
      );
      acc[item.inventoryItemId] = saved ? saved.selectedBags : 0;
      return acc;
    }, {});
    setModalBagQuantities(quantities);
  }, [modalItems, selectedAddon?._id, selectedAddonConfigs]);

  const handleModalBagValueChange = (inventoryItemId, value) => {
    setModalBagQuantities((prev) => ({
      ...prev,
      [inventoryItemId]: value,
    }));
  };

  const modalSelectedItems = useMemo(
    () =>
      sortByName(modalItems, "itemName").map((item) => {
        const bagQty = Number(modalBagQuantities[item.inventoryItemId] || 0);
        const selectedBags = Math.max(0, Math.min(bagQty, item.maxBags));
        const selectedQuantity = selectedBags * item.perBagLimit;
        const bagPrice = item.pricePerBag;
        const selectedTotal = selectedBags * bagPrice;
        const isActive = selectedBags > 0;
        const usedPercent =
          item.maxBags > 0 ? (selectedBags / item.maxBags) * 100 : 0;

        return {
          ...item,
          selectedBags,
          selectedQuantity,
          selectedTotal,
          bagPrice,
          isActive,
          usedPercent,
        };
      }),
    [modalItems, modalBagQuantities],
  );

  const modalTotalPrice = modalSelectedItems.reduce(
    (sum, item) => sum + item.selectedTotal,
    0,
  );

  // Any add-on can be added once at least one item has bags selected.
  const modalCanSubmit = modalSelectedItems.some(
    (item) => item.selectedBags > 0,
  );

  const modalIsUpdate = selectedAddonIds.includes(selectedAddon?._id);

  const handleModalConfirm = () => {
    if (!selectedAddon) return;
    handleConfigureAddon({
      addonId: selectedAddon._id,
      price: modalTotalPrice,
      selectedItems: modalSelectedItems.filter((item) => item.selectedBags > 0),
    });
    setSelectedAddon(null);
  };

  const handleModalClose = () => setSelectedAddon(null);

  // ==================== Order Summary ====================

  const selectedAddonsData = useMemo(
    () =>
      selectedAddonIds
        .map((id) => {
          const base = addons.find((a) => a._id === id);
          if (!base) return null;
          const config = selectedAddonConfigs[id];

          // For upgrade addons: use discountPrice if set, else original price
          const hasDiscount =
            base.addonType === "upgrade" &&
            base.discountPrice !== null &&
            base.discountPrice !== undefined;
          const effectivePrice = hasDiscount
            ? base.discountPrice
            : (base.price ?? 0);
          const price = config?.price ?? effectivePrice;

          const items = (config?.selectedItems || [])
            .filter((item) => (item.selectedQuantity || 0) > 0)
            .map((item) => ({
              inventoryItemId: item.inventoryItemId,
              itemName: item.itemName,
              selectedBags: item.selectedBags || 0,
              selectedTotal: item.selectedTotal || 0,
            }));

          return {
            _id: base._id,
            addonName: base.addonName,
            addonType: base.addonType,
            isFree: !price || Number(price) === 0,
            price,
            originalPrice: hasDiscount ? (base.price ?? 0) : null,
            hasDiscount,
            items,
            totalBags: items.reduce((s, i) => s + i.selectedBags, 0),
            itemCount: items.length,
            hasSubItems: items.length > 1,
          };
        })
        .filter(Boolean),
    [addons, selectedAddonIds, selectedAddonConfigs],
  );

  const addonsTotalPrice = selectedAddonsData.reduce(
    (sum, addon) => sum + (addon.price || 0),
    0,
  );

  const extraBagsCost = extraBagsWithComputed.reduce(
    (sum, bag) => sum + bag.total,
    0,
  );

  const bundlesTotalPrice = bundleSections.reduce(
    (sum, s) => sum + (s.bundle.totalPrice || 0) * s.quantity,
    0,
  );

  const itemsTotalPrice =
    bundlesTotalPrice + addonsTotalPrice + extraBagsCost;

  // Optional shipping insurance — 0.5% of the items subtotal. The amount is
  // always computed so the dealer can see the cost up front; it is only added
  // to the order total when the checkbox is ticked.
  const insuranceAmount =
    Math.round(itemsTotalPrice * SHIPPING_INSURANCE_RATE * 100) / 100;

  const totalOrderPrice =
    itemsTotalPrice + (insuranceEnabled ? insuranceAmount : 0);

  const summaryExtraBags = extraBagsWithComputed.filter((bag) => bag.qty > 0);

  // Per-bundle summary rows for the order summary panel.
  const summaryBundles = useMemo(
    () =>
      bundleSections.map((s) => ({
        _id: s.bundleId,
        bundleName: s.bundle.bundleName,
        minifigQuantity: s.bundle.minifigQuantity,
        unitPrice: s.bundle.totalPrice || 0,
        totalPrice: (s.bundle.totalPrice || 0) * s.quantity,
        quantity: s.quantity,
        bagMultiplier: s.bagMultiplier,
        remainingBagSlots: s.remainingBagSlots,
        torsoBags: s.torsoBags
          .filter((b) => b.assignedQty > 0)
          .map((b) => ({
            _id: b._id,
            bagName: b.bagName,
            quantity: b.assignedQty,
          })),
      })),
    [bundleSections],
  );

  // Every selected bundle must have all its torso slots filled.
  const canCheckout = hasSelectedBundles
    ? bundleSections.every(
        (s) => s.totalAssignedBags > 0 && s.remainingBagSlots === 0,
      )
    : selectedAddonIds.length > 0 || totalExtraBags > 0;

  // ==================== Status ====================

  const isLoading =
    isLoadingBundles ||
    isLoadingAddons ||
    isLoadingExtraBags ||
    isLoadingTorsoBags;

  const isError =
    isErrorBundles || isErrorAddons || isErrorExtraBags || isErrorTorsoBags;

  // ==================== Dealer Checkout ====================

  const { checkout, isCheckoutLoading } = useCheckout();

  const handleDealerCheckout = useCallback(() => {
    if (!canCheckout) return;

    const bundlesPayload = selectedBundleIds
      .map((bundleId) => {
        const split = torsoSplits[bundleId] || {};
        return {
          bundleId,
          quantity: bundleQuantities[bundleId] || 1,
          torsoBags: Object.entries(split)
            .filter(([, qty]) => qty > 0)
            .map(([torsoBagId, quantity]) => ({ torsoBagId, quantity })),
        };
      })
      .filter((b) => b.bundleId);

    const addonPayload = selectedAddonIds.map((id) => {
      const config = selectedAddonConfigs[id];
      return {
        addonId: id,
        selectedItems: config?.selectedItems?.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          selectedBags: item.selectedBags,
        })),
      };
    });

    const extraBagPayload = Object.entries(extraBagQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ extraBagId: id, quantity: qty }));

    checkout({
      orderType: "dealer",
      bundles: bundlesPayload.length > 0 ? bundlesPayload : undefined,
      addons: addonPayload.length > 0 ? addonPayload : undefined,
      extraBags: extraBagPayload.length > 0 ? extraBagPayload : undefined,
      shippingInsurance: insuranceEnabled,
    });
  }, [
    canCheckout,
    checkout,
    selectedBundleIds,
    bundleQuantities,
    torsoSplits,
    selectedAddonIds,
    selectedAddonConfigs,
    extraBagQuantities,
    insuranceEnabled,
  ]);

  return {
    // Setters
    handleToggleBundle,

    // Data
    bundles: bundlesWithSelection,
    addons: addonsWithSelection,
    extraBags: extraBagsWithComputed,

    // Torso picker — only the focused bundle's section is shown
    activeSection,
    bundleTabs,
    hasSelectedBundles,

    // Memos
    maxExtraBags,
    totalExtraBags,

    // Order Summary
    orderSummary: {
      bundles: summaryBundles,
      addons: selectedAddonsData,
      extraBags: summaryExtraBags,
      totalExtraBags,
      totalOrderPrice,
      insuranceEnabled,
      insuranceAmount,
      canCheckout,
      maxBundleQuantity: MAX_BUNDLE_QUANTITY,
    },

    // Handlers
    handleToggleAddon,
    handleExtraBagQtyChange,
    handleSelectTorsoBag,
    handleTorsoBagQtyChange,
    handleBundleQtyChange,
    handleSetActiveBundle,
    handleToggleInsurance,

    // Addon Preview Modal
    addonPreview: {
      addon: selectedAddon,
      items: modalSelectedItems,
      totalPrice: modalTotalPrice,
      canSubmit: modalCanSubmit,
      isUpdate: modalIsUpdate,
      onOpen: setSelectedAddon,
      onClose: handleModalClose,
      onConfirm: handleModalConfirm,
      onValueChange: handleModalBagValueChange,
    },

    // Checkout
    handleDealerCheckout,
    isCheckoutLoading,

    // Status
    isAdmin,
    isLoading,
    isError,
  };
};
