import {
  Truck,
  PackageCheck,
  XCircle,
  Clock,
  RefreshCw,
  Check,
} from "lucide-react";

export const STATUS_CONFIG = {
  paid: {
    label: "Paid",
    variant: "success",
    header: "Thank you for your order!",
    icon: Check,
    iconColor: "text-success bg-success/10 ring-success/20",
    description:
      "Your order has been confirmed and is now being prepared. A copy of your invoice has been sent to ",
  },
  shipped: {
    label: "Shipped",
    variant: "info",
    header: "Your order is on its way!",
    icon: Truck,
    iconColor: "text-blue-600 bg-blue-100 ring-blue-200",
    description:
      "Your package has been dispatched and is moving through the carrier’s network. You can track its progress using the tracking details below.",
  },
  delivered: {
    label: "Delivered",
    variant: "success",
    header: "Your order has been delivered!",
    icon: PackageCheck,
    iconColor: "text-success bg-success/10 ring-success/20",
    description:
      "Your package has reached its destination. We hope you’re happy with your purchase and enjoy your new items!",
  },
  cancelled: {
    label: "Cancelled",
    variant: "destructive",
    header: "Your order has been cancelled",
    icon: XCircle,
    iconColor: "text-destructive bg-destructive/10 ring-destructive/20",
    description:
      "This order will not be processed or shipped. Please see the refund details below for more information.",
  },
};

// Visual overrides for cancelled orders based on refundStatus
export const REFUND_STATUS_CONFIG = {
  pending: {
    label: "Refund Processing",
    variant: "secondary",
    header: "Refund in progress",
    icon: Clock,
    iconColor: "text-amber-600 bg-amber-100 ring-amber-200",
    description:
      "We’ve initiated your refund to your original payment method. Depending on your bank’s processing times, it may take 5–10 business days to post the credit to your account.",
  },
  completed: {
    label: "Refunded",
    variant: "outline",
    header: "Refund Confirmed",
    icon: RefreshCw,
    iconColor: "text-destructive bg-destructive/10 ring-destructive/20",
    description:
      "Your refund has been successfully processed and sent back to your original payment method. Depending on your bank’s processing times, it may take 5–10 business days for the credit to appear in your account.",
  },
};

// Resolve the effective display config for an order (handles refundStatus within cancelled)
export const getOrderStatusConfig = (order) => {
  const status = order?.status || "paid";
  if (status === "cancelled" && order?.refund?.status) {
    const refundConfig = REFUND_STATUS_CONFIG[order.refund.status];
    if (refundConfig) return refundConfig;
  }
  return STATUS_CONFIG[status] || STATUS_CONFIG.paid;
};

export const getDisplayItems = (order, summarize = false) => {
  if (!order) return [];

  // 1. Standard Product Items
  if (order.orderType === "product" || order.productItems) {
    return order.productItems || [];
  }

  // 2. Dealer Items (Manifest)
  if (order.orderType === "dealer" && order.dealerItems) {
    const { bundle, torsoBags, addons, extraBags } = order.dealerItems;
    const items = [];

    // 1. Bundle + Torso Bag (Integrated)
    if (bundle) {
      const torsoDescription =
        torsoBags?.length > 0
          ? torsoBags
              .map(
                (tb) =>
                  `${tb.name}${tb.quantity > 1 ? ` (${tb.quantity}x)` : ""}`,
              )
              .join(", ")
          : undefined;
      items.push({
        _id: bundle.id,
        productName: bundle.name,
        quantity: 1,
        totalPrice: bundle.price,
        description: torsoDescription,
      });
    }

    // 2. Addons (Always Integrated)
    if (addons && Array.isArray(addons)) {
      addons.forEach((addon) => {
        const addonQty = addon.quantity || 1;

        // Build a detailed description of sub-items
        const subItemDesc =
          addon.subItems?.length > 0
            ? addon.subItems.map((sub) => `${sub.name} (${sub.qty})`).join(", ")
            : undefined;

        items.push({
          _id: addon.id,
          productName: addon.name,
          quantity: addonQty,
          totalPrice: addon.totalPrice,
          description: subItemDesc,
        });
      });
    }

    // 3. Extra Bags (Always Grouped)
    if (extraBags && Array.isArray(extraBags) && extraBags.length > 0) {
      const totalQty = extraBags.reduce((sum, b) => sum + b.quantity, 0);
      const totalPrice = extraBags.reduce(
        (sum, b) => sum + (b.price || 0) * b.quantity,
        0,
      );
      const names = extraBags.map((b) => `${b.quantity}x ${b.name}`).join(", ");

      items.push({
        productName: `Extra Bags (${totalQty})`,
        quantity: 1,
        totalPrice: totalPrice,
        description: names,
      });
    }

    return items;
  }

  // 3. Reward Items (Future)
  if (order.orderType === "reward" && order.rewardItems) {
    return order.rewardItems;
  }

  return [];
};

// Derive order tabs from fetched statuses (backend source of truth)
export const buildOrderTabs = (statuses) => {
  const base = [{ value: "all", label: "All Orders" }];
  if (!statuses) return base;
  return [
    ...base,
    ...Object.values(statuses)
      .filter((s) => s !== "failed")
      .map((s) => ({ value: s, label: STATUS_CONFIG[s]?.label || s })),
  ];
};

// Derive admin status transition options from fetched validTransitions
export const buildAdminStatusOptions = (validTransitions) => {
  if (!validTransitions) return {};
  const result = {};
  for (const [from, toList] of Object.entries(validTransitions)) {
    result[from] = toList.map((to) => ({
      value: to,
      label: `Mark as ${STATUS_CONFIG[to]?.label || to}`,
    }));
  }
  return result;
};
