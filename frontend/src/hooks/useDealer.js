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
  const [selectedTorsoBagIds, setSelectedTorsoBagIds] = useState([]);

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
      const preferred = bundles.find((b) => b.minifigQuantity === 500) ?? bundles[0];
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
      if (!selectedBundle || isCustomBundle) return 1;
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
      return rawTorsoBags.filter(
        (b) => b.targetBundleSize === selectedBundle.minifigQuantity,
      );
    }

    return rawTorsoBags
      .map((bag) => {
        const mult = getBagMultiplier(bag.targetBundleSize);
        return mult ? { ...bag, multiplier: mult } : null;
      })
      .filter(Boolean);
  }, [rawTorsoBags, selectedBundle, isCustomBundle, getBagMultiplier]);

  // ==================== Computed Selections ====================

  const bundlesWithSelection = useMemo(() => {
    return bundles.map((bundle) => ({
      ...bundle,
      isSelected: selectedBundleId === bundle._id,
    }));
  }, [bundles, selectedBundleId]);

  const addonsWithSelection = useMemo(() => {
    return addons.map((addon) => {
      let isOutOfStock = false;
      if (addon.addonType === "bundle") {
        const items = addon.bundleItems || [];
        // An addon bundle is out of stock if it has items and ALL of them have no bags available
        isOutOfStock =
          items.length > 0 &&
          items.every((item) => {
            const stock = Number(item.inventoryItemId?.stock || 0);
            const limit = Number(item.quantityPerBag || 0);
            return limit > 0 && stock < limit;
          });
      }

      return {
        ...addon,
        isSelected: selectedAddonIds.includes(addon._id),
        hasItems:
          addon.addonType === "bundle" && (addon.bundleItems?.length || 0) > 0,
        isOutOfStock,
      };
    });
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

  // Add isSelected + firstImage + scaled items for display
  const torsoBagsWithSelection = useMemo(() => {
    return torsoBags.map((bag) => ({
      ...bag,
      isSelected: selectedTorsoBagIds.includes(bag._id),
      firstImage: bag.items?.[0]?.image?.url,
    }));
  }, [torsoBags, selectedTorsoBagIds]);

  // ==================== Effects ====================

  // Reset selections when bundle changes
  useEffect(() => {
    if (totalExtraBags > maxExtraBags) {
      setExtraBagQuantities({});
    }
  }, [maxExtraBags, totalExtraBags]);

  // Clear torso bag selection when bundle changes (bags might differ)
  useEffect(() => {
    setSelectedTorsoBagIds([]);
  }, [selectedBundleId]);

  // Auto-select torso bag if only one is available
  useEffect(() => {
    if (torsoBags.length === 1 && selectedTorsoBagIds.length === 0) {
      setSelectedTorsoBagIds([torsoBags[0]._id]);
    }
  }, [torsoBags, selectedTorsoBagIds]);

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

        const perBagLimit = Number(item.quantityPerBag || 0);
        const stock = Number(inventory.stock || 0);
        const maxBags =
          perBagLimit > 0 ? Math.max(0, Math.floor(stock / perBagLimit)) : 0;

        return {
          key: `${inventory._id}-${index}`,
          inventoryItemId: inventory._id,
          itemName: inventory.minifigName,
          image: inventory.image,
          color: inventory.colorId,
          unitPrice: Number(inventory.price || 0),
          pricePerBag: Number(item.pricePerBag || 0),
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

        const isOutOfStock = item.maxBags === 0;

        return {
          ...item,
          selectedBags,
          selectedQuantity,
          selectedTotal,
          bagPrice,
          isActive,
          usedPercent,
          isOutOfStock,
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
    if (selectedTorsoBagIds.includes(bagId)) {
      setSelectedTorsoBagIds([]);
      return;
    }
    setSelectedTorsoBagIds([bagId]);
  };

  const lastSelectedBag =
    torsoBags.find((b) => b._id === selectedTorsoBagIds[0]) || null;

  const currentMultiplier = lastSelectedBag?.multiplier || 1;

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
          const effectivePrice = hasDiscount ? base.discountPrice : (base.price ?? 0);
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
      return bag ? { _id: bag._id, bagName: bag.bagName } : null;
    })
    .filter(Boolean);

  const canCheckout = !!selectedBundle && selectedTorsoBagIds.length > 0;

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

    checkout({
      orderType: "dealer",
      bundleId: selectedBundleId,
      torsoBagId: selectedTorsoBagIds[0] || null,
      addons: addonPayload.length > 0 ? addonPayload : undefined,
      extraBags: extraBagPayload.length > 0 ? extraBagPayload : undefined,
    });
  }, [
    canCheckout,
    checkout,
    selectedBundleId,
    selectedTorsoBagIds,
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

    // Handlers
    handleToggleAddon,
    handleExtraBagQtyChange,
    handleSelectTorsoBag,

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
