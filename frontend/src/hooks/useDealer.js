import { useState, useMemo, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  useGetDealerBundlesQuery,
  useGetDealerAddonsQuery,
  useGetDealerExtraBagsQuery,
  useGetDealerTorsoBagsQuery,
} from "@/redux/api/authApi";
import { sortByName } from "@/utils/formatting";
import { useReorderTorsoBagItemsMutation } from "@/redux/api/adminApi";
import { useCheckout } from "@/hooks/useCheckout";

export const useDealer = () => {
  const { user } = useSelector((state) => state.auth);
  const isAdmin = user?.role === "admin";

  const [selectedBundleId, setSelectedBundleId] = useState(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [selectedAddonConfigs, setSelectedAddonConfigs] = useState({});
  const [selectedAddon, setSelectedAddon] = useState(null);
  const [extraBagQuantities, setExtraBagQuantities] = useState({});
  const [torsoBagSplitQuantities, setTorsoBagSplitQuantities] = useState({});
  const [lastClickedBagId, setLastClickedBagId] = useState(null);

  // Torso reorder state
  const [localItems, setLocalItems] = useState([]);
  const [hasReorderChanges, setHasReorderChanges] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

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

  const [reorderTorsoBagItems] = useReorderTorsoBagItemsMutation();

  const bundles = Array.isArray(bundleData?.bundles) ? bundleData.bundles : [];
  const addons = Array.isArray(addonData?.addons) ? addonData.addons : [];
  const extraBags = Array.isArray(extraBagData?.extraBags)
    ? extraBagData.extraBags
    : [];

  // ==================== Bundle Selection ====================

  // Auto-select 500-minifig bundle as default, fall back to first
  useEffect(() => {
    if (bundles.length > 0 && !selectedBundleId) {
      const preferred =
        bundles.find((b) => b.minifigQuantity === 500) ?? bundles[0];
      setSelectedBundleId(preferred._id);
    }
  }, [bundles, selectedBundleId]);

  const selectedBundle = useMemo(
    () => bundles.find((b) => b._id === selectedBundleId),
    [bundles, selectedBundleId],
  );

  // ==================== Bundle Type & Multiplier ====================

  // Find the smallest "regular" bundle = the base

  const isCustomBundle = selectedBundle?.torsoBagType === "custom";

  // Misc quantity from API (backend computes using MISC_RATIO)
  const miscQuantity = selectedBundle?.miscQuantity ?? 0;

  // ==================== Torso Bag Fetching ====================

  // Fetch all active bags to allow intelligent filtering in frontend
  const {
    data: torsoBagData,
    isLoading: isLoadingTorsoBags,
    isError: isErrorTorsoBags,
  } = useGetDealerTorsoBagsQuery(
    {}, // Fetch all active
    { skip: !selectedBundle },
  );

  const rawTorsoBags = Array.isArray(torsoBagData?.torsoBags)
    ? torsoBagData.torsoBags
    : [];

  // Helper to determine if a bag size fits this bundle perfectly or via multiplier
  const getBagMultiplier = useCallback(
    (bagSize) => {
      if (!selectedBundle) return 1;

      if (isCustomBundle) {
        return Math.max(1, Math.floor(selectedBundle.minifigQuantity / 100));
      }

      if (!bagSize || bagSize <= 0) return 1;

      const bundleQty = selectedBundle.minifigQuantity;

      // 1. Must be a divisor
      if (bundleQty % bagSize !== 0) return null;

      return bundleQty / bagSize;
    },
    [selectedBundle, isCustomBundle],
  );

  const torsoBags = useMemo(() => {
    if (!selectedBundle) return [];
    if (isCustomBundle) {
      const mult = getBagMultiplier();
      return rawTorsoBags
        .filter((b) => b.targetBundleSize === selectedBundle.minifigQuantity)
        .map((bag) => ({ ...bag, multiplier: mult }));
    }

    return rawTorsoBags
      .map((bag) => {
        const mult = getBagMultiplier(bag.targetBundleSize);
        return mult ? { ...bag, multiplier: mult } : null;
      })
      .filter(Boolean);
  }, [rawTorsoBags, selectedBundle, isCustomBundle, getBagMultiplier]);

  // Total number of bag slots for this bundle (e.g. 3 for 300-bundle with 100-size bags)
  const bagMultiplier = torsoBags[0]?.multiplier ?? 1;

  // Derived selection state from split quantities
  const selectedTorsoBagIds = useMemo(
    () =>
      Object.entries(torsoBagSplitQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([id]) => id),
    [torsoBagSplitQuantities],
  );

  const totalAssignedBags = useMemo(
    () =>
      Object.values(torsoBagSplitQuantities).reduce((sum, qty) => sum + qty, 0),
    [torsoBagSplitQuantities],
  );

  const remainingBagSlots = bagMultiplier - totalAssignedBags;

  // ==================== Computed Selections ====================

  const bundlesWithSelection = useMemo(() => {
    return bundles.map((bundle) => ({
      ...bundle,
      isSelected: selectedBundleId === bundle._id,
    }));
  }, [bundles, selectedBundleId]);

  const addonsWithSelection = useMemo(() => {
    return addons.map((addon) => ({
      ...addon,
      isSelected: selectedAddonIds.includes(addon._id),
      hasItems:
        addon.addonType === "bundle" && (addon.bundleItems?.length || 0) > 0,
    }));
  }, [addons, selectedAddonIds]);

  const maxExtraBags = selectedBundle
    ? Math.floor(selectedBundle.minifigQuantity / 100)
    : 0;

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

  // Add isSelected + assignedQty + firstImage for display
  const torsoBagsWithSelection = useMemo(() => {
    return torsoBags.map((bag) => ({
      ...bag,
      isSelected: (torsoBagSplitQuantities[bag._id] || 0) > 0,
      assignedQty: torsoBagSplitQuantities[bag._id] || 0,
      firstImage: bag.items?.[0]?.image?.url,
    }));
  }, [torsoBags, torsoBagSplitQuantities]);

  // ==================== Effects ====================

  // Reset selections when bundle changes
  useEffect(() => {
    if (totalExtraBags > maxExtraBags) {
      setExtraBagQuantities({});
    }
  }, [maxExtraBags, totalExtraBags]);

  // Clear torso bag selection when bundle changes (bags might differ)
  useEffect(() => {
    setTorsoBagSplitQuantities({});
    setLastClickedBagId(null);
  }, [selectedBundleId]);

  // Auto-select first (oldest) bag when bags load — always assign all slots to it
  useEffect(() => {
    const hasSelection = Object.values(torsoBagSplitQuantities).some(
      (q) => q > 0,
    );
    if (torsoBags.length > 0 && !hasSelection && bagMultiplier > 0) {
      setTorsoBagSplitQuantities({ [torsoBags[0]._id]: bagMultiplier });
      setLastClickedBagId(torsoBags[0]._id);
    }
  }, [torsoBags, torsoBagSplitQuantities, bagMultiplier]);

  // ==================== Handlers ====================

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

  const modalTotalBags = modalSelectedItems.reduce(
    (sum, item) => sum + item.selectedBags,
    0,
  );

  const modalTotalPrice = modalSelectedItems.reduce(
    (sum, item) => sum + item.selectedTotal,
    0,
  );

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

  const handleSelectTorsoBag = (bagId) => {
    // Always switch the preview to the clicked bag (for comparison browsing)
    setLastClickedBagId(bagId);

    const currentQty = torsoBagSplitQuantities[bagId] || 0;
    if (currentQty > 0) {
      // Already in order — just preview it, don't deselect
      return;
    }

    // Not yet in order — add with qty 1, stealing a slot from the bag with the most qty
    setTorsoBagSplitQuantities((prev) => {
      const usedByOthers = Object.entries(prev).reduce(
        (acc, [id, qty]) => (id === bagId ? acc : acc + qty),
        0,
      );

      if (usedByOthers < bagMultiplier) {
        // Free slot available — just add
        return { ...prev, [bagId]: 1 };
      }

      // All slots taken — steal one from the bag with the highest qty
      const donorEntry = Object.entries(prev)
        .filter(([id]) => id !== bagId)
        .sort(([, a], [, b]) => b - a)[0];

      if (!donorEntry) return prev;
      const [donorId, donorQty] = donorEntry;
      const next = { ...prev, [bagId]: 1 };
      if (donorQty - 1 > 0) {
        next[donorId] = donorQty - 1;
      } else {
        delete next[donorId];
      }
      return next;
    });
  };

  // Fine-grained quantity adjustment used by the order summary controls
  const handleTorsoBagQtyChange = (bagId, newQty) => {
    setTorsoBagSplitQuantities((prev) => {
      const usedByOthers = Object.entries(prev).reduce(
        (acc, [id, qty]) => (id === bagId ? acc : acc + qty),
        0,
      );
      const clampedQty = Math.max(
        0,
        Math.min(newQty, bagMultiplier - usedByOthers),
      );
      if (clampedQty === 0) {
        const { [bagId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [bagId]: clampedQty };
    });
  };

  const lastSelectedBag = useMemo(() => {
    const preferredId =
      lastClickedBagId && (torsoBagSplitQuantities[lastClickedBagId] || 0) > 0
        ? lastClickedBagId
        : selectedTorsoBagIds[0] || null;
    return preferredId
      ? torsoBags.find((b) => b._id === preferredId) || null
      : null;
  }, [
    lastClickedBagId,
    torsoBagSplitQuantities,
    selectedTorsoBagIds,
    torsoBags,
  ]);

  const currentMultiplier = useMemo(() => {
    if (isCustomBundle || !lastSelectedBag) return 1;
    const assignedQty = torsoBagSplitQuantities[lastSelectedBag._id] || 0;
    return assignedQty > 0 ? assignedQty : lastSelectedBag.multiplier || 1;
  }, [isCustomBundle, lastSelectedBag, torsoBagSplitQuantities]);

  // Build display items (apply multiplier for regular bundles)
  const displayItems = useMemo(() => {
    if (!lastSelectedBag?.items) return [];
    return lastSelectedBag.items.map((item) => ({
      ...item,
      displayQuantity: isCustomBundle
        ? item.quantity
        : item.quantity * currentMultiplier,
    }));
  }, [lastSelectedBag, isCustomBundle, currentMultiplier]);

  // ==================== Reorder Logic ====================

  useEffect(() => {
    if (lastSelectedBag?.items) {
      setLocalItems(lastSelectedBag.items);
      setHasReorderChanges(false);
    }
  }, [lastSelectedBag]);

  const reorderSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleReorderDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id && lastSelectedBag) {
      const oldIndex = parseInt(active.id);
      const newIndex = parseInt(over.id);
      setLocalItems((prev) => arrayMove(prev, oldIndex, newIndex));
      setHasReorderChanges(true);
    }
  };

  const handleSaveReorder = async () => {
    if (!lastSelectedBag || !hasReorderChanges) return;
    setIsSavingOrder(true);
    try {
      const reorderIndices = localItems.map((newItem) =>
        lastSelectedBag.items.findIndex(
          (origItem) => origItem.image?.url === newItem.image?.url,
        ),
      );
      await reorderTorsoBagItems({
        id: lastSelectedBag._id,
        itemOrder: reorderIndices,
      }).unwrap();
      setHasReorderChanges(false);
    } catch (error) {
      console.error("Failed to save order:", error);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleResetReorder = () => {
    if (lastSelectedBag?.items) {
      setLocalItems(lastSelectedBag.items);
      setHasReorderChanges(false);
    }
  };

  const reorderItemIds = useMemo(
    () => localItems.map((_, idx) => idx.toString()),
    [localItems],
  );

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

  const totalOrderPrice =
    (selectedBundle?.totalPrice || 0) + addonsTotalPrice + extraBagsCost;

  const summaryExtraBags = extraBagsWithComputed.filter((bag) => bag.qty > 0);

  const summaryTorsoBags = selectedTorsoBagIds
    .map((id) => {
      const bag = torsoBags.find((b) => b._id === id);
      const qty = torsoBagSplitQuantities[id] || 0;
      return bag && qty > 0
        ? { _id: bag._id, bagName: bag.bagName, quantity: qty }
        : null;
    })
    .filter(Boolean);

  const canCheckout =
    !!selectedBundle && totalAssignedBags > 0 && remainingBagSlots === 0;

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

    const torsoBagsPayload = selectedTorsoBagIds
      .map((id) => ({
        torsoBagId: id,
        quantity: torsoBagSplitQuantities[id] || 0,
      }))
      .filter((b) => b.quantity > 0);

    checkout({
      orderType: "dealer",
      bundleId: selectedBundleId,
      torsoBags: torsoBagsPayload.length > 0 ? torsoBagsPayload : undefined,
      addons: addonPayload.length > 0 ? addonPayload : undefined,
      extraBags: extraBagPayload.length > 0 ? extraBagPayload : undefined,
    });
  }, [
    canCheckout,
    checkout,
    selectedBundleId,
    selectedTorsoBagIds,
    torsoBagSplitQuantities,
    selectedAddonIds,
    selectedAddonConfigs,
    extraBagQuantities,
  ]);

  return {
    // States & Setters
    setSelectedBundleId,

    // Data
    bundles: bundlesWithSelection,
    addons: addonsWithSelection,
    extraBags: extraBagsWithComputed,
    torsoBags: torsoBagsWithSelection,

    // Bundle Type Info
    isCustomBundle,
    multiplier: currentMultiplier,
    miscQuantity: miscQuantity * currentMultiplier,
    displayItems,

    // Memos
    selectedBundle,
    maxExtraBags,
    totalExtraBags,
    lastSelectedBag,

    // Order Summary
    orderSummary: {
      addons: selectedAddonsData,
      extraBags: summaryExtraBags,
      torsoBags: summaryTorsoBags,
      totalExtraBags,
      totalOrderPrice,
      canCheckout,
    },

    // Bag split info
    bagMultiplier,
    totalAssignedBags,
    remainingBagSlots,

    // Handlers
    handleToggleAddon,
    handleExtraBagQtyChange,
    handleSelectTorsoBag,
    handleTorsoBagQtyChange,

    // Addon Preview Modal
    addonPreview: {
      addon: selectedAddon,
      items: modalSelectedItems,
      totalBags: modalTotalBags,
      totalPrice: modalTotalPrice,
      canSubmit: modalCanSubmit,
      isUpdate: modalIsUpdate,
      onOpen: setSelectedAddon,
      onClose: handleModalClose,
      onConfirm: handleModalConfirm,
      onValueChange: handleModalBagValueChange,
    },

    // Reorder (Admin)
    localItems,
    hasReorderChanges,
    isSavingOrder,
    reorderSensors,
    reorderItemIds,
    handleReorderDragEnd,
    handleSaveReorder,
    handleResetReorder,

    // Checkout
    handleDealerCheckout,
    isCheckoutLoading,

    // Status
    isAdmin,
    isLoading,
    isError,
  };
};
