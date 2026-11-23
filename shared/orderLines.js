// Backorders: the lines of an order that can be held back and shipped later.
//
// Every shippable line of an order gets a short, stable key built from where it
// sits in the order document, so a backorder can point at it:
//   p<i>          productItems[i]
//   b<i>t<j>      dealerItems.bundles[i].torsoBags[j]
//   b<i>          dealerItems.bundles[i] (a bundle with no torso bags listed)
//   t<j>          dealerItems.torsoBags[j] (legacy single-bundle orders)
//   a<i>s<j>      dealerItems.addons[i].subItems[j]
//   a<i>          dealerItems.addons[i] (an add-on with no sub-items)
//   x<i>          dealerItems.extraBags[i]
// Order lines are never reordered or removed after checkout, so the keys stay valid.
//
// Used by the backend (to check what staff send) and the frontend (to list the
// lines in the backorder dialog and show what is still waiting).

export const BACKORDER_STATUSES = {
  AWAITING: "awaiting",
  SHIPPED: "shipped",
};

const positive = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);

export const getOrderLines = (order) => {
  const lines = [];
  if (!order) return lines;

  (order.productItems || []).forEach((item, i) => {
    const name = item.colorName && !String(item.productName).endsWith(` - ${item.colorName}`)
      ? `${item.productName} - ${item.colorName}`
      : item.productName;
    lines.push({ key: `p${i}`, name, quantity: positive(item.quantity), unit: "item", imageUrl: item.imageUrl });
  });

  const di = order.dealerItems;
  if (di) {
    if (di.bundles?.length) {
      di.bundles.forEach((bundle, i) => {
        if (bundle.torsoBags?.length) {
          bundle.torsoBags.forEach((tb, j) =>
            lines.push({ key: `b${i}t${j}`, name: tb.name, group: bundle.name, quantity: positive(tb.quantity), unit: "bag" }),
          );
        } else {
          lines.push({ key: `b${i}`, name: bundle.name, quantity: positive(bundle.quantity || 1), unit: "bundle" });
        }
      });
    } else if (di.torsoBags?.length) {
      di.torsoBags.forEach((tb, j) =>
        lines.push({ key: `t${j}`, name: tb.name, group: di.bundle?.name, quantity: positive(tb.quantity), unit: "bag" }),
      );
    }

    (di.addons || []).forEach((addon, i) => {
      if (addon.subItems?.length) {
        addon.subItems.forEach((sub, j) =>
          lines.push({
            key: `a${i}s${j}`,
            name: sub.colorName ? `${sub.name} - ${sub.colorName}` : sub.name,
            group: addon.name,
            quantity: positive(sub.qty),
            unit: "bag",
            bin: sub.bin,
            imageUrl: sub.imageUrl,
          }),
        );
      } else {
        lines.push({ key: `a${i}`, name: addon.name, quantity: positive(addon.quantity || 1), unit: "item" });
      }
    });

    (di.extraBags || []).forEach((bag, i) =>
      lines.push({ key: `x${i}`, name: bag.name, quantity: positive(bag.quantity), unit: "bag" }),
    );
  }

  return lines.filter((l) => l.quantity > 0);
};

// Backorder entries still waiting to ship.
export const getAwaitingBackorders = (order) =>
  (order?.backorders || []).filter((b) => b.status === BACKORDER_STATUSES.AWAITING);

export const hasAwaitingBackorder = (order) =>
  order?.status !== "cancelled" && getAwaitingBackorders(order).length > 0;

// The later shipments of an order, in order: [{ generation, status, shipping, lines }].
// Shipment 1 is the order itself (its own status and tracking); these are 2, 3, …
export const getBackorderShipments = (order) => {
  const byGen = new Map();
  for (const b of order?.backorders || []) {
    const gen = b.generation || 2;
    const key = `${gen}-${b.status}`;
    if (!byGen.has(key)) {
      byGen.set(key, { generation: gen, status: b.status, shipping: b.shipping, note: b.note, lines: [] });
    }
    const group = byGen.get(key);
    group.lines.push(b);
    if (!group.note && b.note) group.note = b.note;
  }
  return [...byGen.values()].sort((a, b) => a.generation - b.generation);
};

// How many of each line are held back (all generations still waiting), by key.
export const awaitingQuantityByKey = (order) => {
  const map = {};
  for (const b of getAwaitingBackorders(order)) map[b.lineKey] = (map[b.lineKey] || 0) + b.quantity;
  return map;
};
