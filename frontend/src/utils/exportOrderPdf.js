import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import {
  formatCurrency,
  formatDate,
  formatFullName,
  formatPhone,
} from "@/utils/formatting";
import {
  getOrderStatusConfig,
  splitProductItemName,
} from "@/constant/orderData";
import { perBagUnit } from "@shared/inventoryData";
import { buildCloudinaryUrl } from "@/utils/cloudinary";

// ── Design tokens ─────────────────────────────────────────────────────────────
const M = 12;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - M * 2;
const IMG_CELL_W = 16;
const IMG_SIZE = 13;

const C = {
  brand: [14, 165, 233],
  accent: [22, 101, 52],
  accentLight: [220, 252, 231],
  accentText: [22, 163, 74],
  white: [255, 255, 255],
  gray100: [250, 250, 251],
  gray200: [229, 231, 235],
  gray600: [75, 85, 99],
  gray900: [17, 24, 39],
  red: [239, 68, 68],
  amber: [146, 64, 14],
};

const STATUS_COLORS = {
  paid: C.accentText,
  processing: [37, 99, 235],
  shipped: [59, 130, 246],
  cancelled: C.red,
  refunded: C.amber,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const safe = (v) => (v == null || v === "" ? "—" : String(v));
const rgb = (doc, color) => doc.setTextColor(...color);
const fill = (doc, color) => doc.setFillColor(...color);

const resetText = (doc) => doc.setTextColor(...C.gray900);

const rect = (doc, x, y, w, h, color, style = "F") => {
  fill(doc, color);
  doc.rect(x, y, w, h, style);
};

// A price drop captured on the order line, normalized into the figures both the
// chip and the struck-through price need. Returns null unless the two prices
// describe a real markdown, so callers can drop it in unguarded.
// Mirrors <DiscountBadge /> in the on-screen views.
const priceDropInfo = (original, paid) => {
  const originalPrice = Number(original) || 0;
  const paidPrice = Number(paid) || 0;
  if (originalPrice <= 0 || paidPrice <= 0 || paidPrice >= originalPrice)
    return null;

  return {
    originalPrice,
    percentOff: Math.round(((originalPrice - paidPrice) / originalPrice) * 100),
  };
};

// Dealer add-on sub-items carry the flash-sale snapshot under its own names.
const flashSaleInfo = (sub) =>
  priceDropInfo(sub?.originalPricePerBag, sub?.pricePerBag);

// The "20% OFF" chip, pinned to the top-right of the row's thumbnail the same
// way the screen views overlay it. Falls back to the middle of the image cell
// when the line has no picture.
const drawDiscountBadge = (doc, cell, label, hasImage) => {
  doc.setFontSize(5);
  doc.setFont("helvetica", "bold");

  const w = doc.getTextWidth(label) + 1.6;
  const h = 3;
  const imgX = cell.x + (cell.width - IMG_SIZE) / 2;
  const imgY = cell.y + (cell.height - IMG_SIZE) / 2;
  const x = hasImage ? imgX + IMG_SIZE - w : cell.x + (cell.width - w) / 2;
  const y = hasImage ? imgY : cell.y + (cell.height - h) / 2;

  rect(doc, x, y, w, h, C.red);
  rgb(doc, C.white);
  doc.text(label, x + w / 2, y + h - 0.9, { align: "center" });
  resetText(doc);
};

// The pre-sale unit price, struck through beneath the price actually charged.
// Drawn by hand rather than as a second text line so the rule can be laid over
// it — jsPDF has no strikethrough of its own.
const drawStruckPrice = (doc, cell, text) => {
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  rgb(doc, C.gray600);

  const cx = cell.x + cell.width / 2;
  const baseline = cell.y + cell.height - 2.5;
  doc.text(text, cx, baseline, { align: "center" });

  const halfW = doc.getTextWidth(text) / 2;
  doc.setDrawColor(...C.gray600);
  doc.setLineWidth(0.2);
  doc.line(cx - halfW, baseline - 0.8, cx + halfW, baseline - 0.8);
  resetText(doc);
};

const ensureSpace = (doc, y, needed = 35) => {
  if (y + needed > 282) {
    doc.addPage();
    return M;
  }
  return y;
};

// Cache decoded images across exports so repeated images / re-exports are instant.
const imageCache = new Map();
const IMG_TIMEOUT_MS = 8000;

// Decode one URL into a downscaled PNG data URL. Resolves null on any failure.
const loadImageOnce = (src, maxPx) =>
  new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    // Don't let a slow/hanging image block the whole export.
    const timer = setTimeout(() => finish(null), IMG_TIMEOUT_MS);

    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/png"));
      } catch {
        finish(null);
      }
    };
    img.onerror = () => finish(null);
    img.src = src;
  });

// Fetch + decode an image for embedding in the PDF.
//
// Requests a small PNG-encoded Cloudinary derivative (jsPDF can't embed WebP)
// so each download is a few KB instead of the multi-MB original, and retries
// once on failure. Combined with the concurrency limit in the prefetch pool,
// this is what stops images silently dropping out of large orders.
const fetchImageAsBase64 = (url, maxPx = 150) => {
  if (!url) return Promise.resolve(null);

  const src = buildCloudinaryUrl(url, {
    width: maxPx,
    height: maxPx,
    format: "png",
  });

  const cacheKey = `${src}@${maxPx}`;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

  const promise = (async () => {
    const result = await loadImageOnce(src, maxPx);
    return result ?? (await loadImageOnce(src, maxPx)); // one retry
  })();

  // Cache successes; drop failures so a later export can retry them.
  promise.then((result) => {
    if (result == null) imageCache.delete(cacheKey);
  });
  imageCache.set(cacheKey, promise);
  return promise;
};

// Run async `fn` over `items` with at most `limit` in flight at once, so a
// 50+ item order doesn't saturate the browser's connection pool (which is what
// caused later images to time out and vanish from the PDF).
const mapWithConcurrency = async (items, limit, fn) => {
  let cursor = 0;
  const runNext = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await fn(items[index], index);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, runNext);
  await Promise.all(workers);
};

// ── Layout primitives ─────────────────────────────────────────────────────────

const sectionHeader = (doc, y, title) => {
  rect(doc, M, y, 1, 6, C.brand);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  rgb(doc, C.gray600);
  doc.text(title.toUpperCase(), M + 3, y + 4.5);
  resetText(doc);
  return y + 10;
};

// ── Key-value table ───────────────────────────────────────────────────────────
const kvTable = (doc, y, rows, onParseCell, onDrawCell) => {
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    tableWidth: CONTENT_W,
    theme: "plain",
    styles: {
      fontSize: 10,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      overflow: "linebreak",
      lineColor: C.gray200,
      lineWidth: 0.2,
      valign: "middle",
    },
    alternateRowStyles: { fillColor: C.gray100 },
    columnStyles: {
      0: {
        fontStyle: "bold",
        textColor: C.gray600,
        cellWidth: 48,
        fontSize: 9,
      },
      1: { textColor: C.gray900, halign: "left" },
    },
    body: rows,
    didParseCell: onParseCell,
    didDrawCell: onDrawCell,
  });
  return doc.lastAutoTable.finalY + 6;
};

// ── Plain items table (no images) ─────────────────────────────────────────────
const itemsTable = (doc, y, head, body, colStyles = {}, onParseCell) => {
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    tableWidth: CONTENT_W,
    theme: "plain",
    rowPageBreak: "avoid",
    headStyles: {
      fillColor: C.brand,
      textColor: C.white,
      fontSize: 9,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize: 9.5,
      cellPadding: { top: 3.5, bottom: 3, left: 3, right: 3 },
      overflow: "linebreak",
      textColor: C.gray900,
      lineColor: C.gray200,
      lineWidth: 0.2,
      valign: "middle",
    },
    alternateRowStyles: { fillColor: C.gray100 },
    columnStyles: colStyles,
    head: [head],
    body,
    didParseCell: (data) => {
      if (data.section === "head" && colStyles[data.column.index]?.halign) {
        data.cell.styles.halign = colStyles[data.column.index].halign;
      }
      onParseCell?.(data);
    },
  });
  return doc.lastAutoTable.finalY + 6;
};

// ── Items table WITH image column (index 0) ───────────────────────────────────
// `badges` maps a row index to a chip drawn over its thumbnail (flash-sale
// discounts); `onDrawCell` lets the caller decorate any other cell.
const itemsTableWithImages = (
  doc,
  y,
  head,
  body,
  imgs,
  colStyles = {},
  onParseCell,
  badges = {},
  onDrawCell,
) => {
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    tableWidth: CONTENT_W,
    theme: "plain",
    rowPageBreak: "avoid",
    headStyles: {
      fillColor: C.brand,
      textColor: C.white,
      fontSize: 9,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize: 9.5,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      overflow: "linebreak",
      minCellHeight: IMG_CELL_W,
      valign: "middle",
      textColor: C.gray900,
      lineColor: C.gray200,
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: C.gray100 },
    columnStyles: {
      0: { cellWidth: IMG_CELL_W, cellPadding: 1, halign: "center" },
      ...colStyles,
    },
    head: [["", ...head]],
    body: body.map((row) => ["", ...row]),
    didParseCell: (data) => {
      // Mirror column halign onto head cells (skip image col 0)
      if (
        data.section === "head" &&
        data.column.index > 0 &&
        colStyles[data.column.index]?.halign
      ) {
        data.cell.styles.halign = colStyles[data.column.index].halign;
      }
      onParseCell?.(data);
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;

      if (data.column.index === 0) {
        const img = imgs[data.row.index];
        if (img) {
          const cx = data.cell.x + (data.cell.width - IMG_SIZE) / 2;
          const cy = data.cell.y + (data.cell.height - IMG_SIZE) / 2;
          try {
            doc.addImage(img, "PNG", cx, cy, IMG_SIZE, IMG_SIZE);
          } catch {
            /* skip */
          }
        }
        const badge = badges[data.row.index];
        if (badge) drawDiscountBadge(doc, data.cell, badge, Boolean(img));
      }

      onDrawCell?.(data);
    },
  });
  return doc.lastAutoTable.finalY + 6;
};

// ── Main export ───────────────────────────────────────────────────────────────
export const exportOrderToPdf = async (order) => {
  if (!order) return;

  const toastId = toast.loading("Preparing PDF…");
  try {
    await buildOrderPdf(order);
    toast.success("PDF ready", { id: toastId });
  } catch (error) {
    console.error("Failed to export order PDF:", error);
    toast.error("Failed to export PDF", { id: toastId });
  }
};

const buildOrderPdf = async (order) => {
  const isDealer =
    order.orderType === "dealer" || order.orderType === "wholesale";

  // Pre-fetch images. Collect every image as a flat task first, then decode
  // them through a bounded pool so a large order can't overload the network and
  // drop images. Each task writes its decoded result back into the right slot.
  const productImgs = {};
  const addonImgs = {};
  const imageTasks = [];

  if (!isDealer) {
    order.productItems?.forEach((item, i) => {
      if (item.imageUrl) {
        imageTasks.push({
          url: item.imageUrl,
          assign: (img) => {
            productImgs[i] = img;
          },
        });
      }
    });
  } else {
    order.dealerItems?.addons?.forEach((addon, ai) => {
      addonImgs[ai] = {};
      addon.subItems?.forEach((sub, si) => {
        if (sub.imageUrl) {
          imageTasks.push({
            url: sub.imageUrl,
            assign: (img) => {
              addonImgs[ai][si] = img;
            },
          });
        }
      });
    });
  }

  await mapWithConcurrency(imageTasks, 6, async (task) => {
    task.assign(await fetchImageAsBase64(task.url));
  });

  // Build PDF
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const invoice =
    order.payment?.stripeInvoiceNumber || order._id?.substring(0, 7) || "—";
  const statusLabel = getOrderStatusConfig(order).label;
  const statusColor = STATUS_COLORS[order.status] ?? C.gray600;

  // ════════════════════════════════════════════════════════════════
  // HEADER
  // ════════════════════════════════════════════════════════════════
  // Right column: Invoice # → Exported on → Status pill  (spans y≈10–29)
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  rgb(doc, C.gray600);
  doc.text(`Invoice #${invoice}`, PAGE_W - M, 13, { align: "right" });
  doc.text(
    `Exported on ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
    PAGE_W - M,
    19,
    { align: "right" },
  );

  const statusLabelUpper = statusLabel.toUpperCase();
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  const textW = doc.getTextWidth(statusLabelUpper);
  const pillW = Math.max(26, textW + 6);
  const pillH = 7;
  const pillX = PAGE_W - M - pillW;
  const pillY = 22;

  rect(doc, pillX, pillY, pillW, pillH, statusColor);
  rgb(doc, C.white);
  // Visually centered: baseline = pillY + (pillH + capHeight) / 2  (capHeight ≈ 2mm at 7.5pt)
  doc.text(statusLabelUpper, pillX + pillW / 2, pillY + (pillH + 2) / 2, {
    align: "center",
  });

  // "Order Summary" baseline centered on the right column (center ≈ y=19.5)
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  rgb(doc, C.gray900);
  doc.text("Order Summary", M, 23);

  resetText(doc);

  let y = 38;

  // ════════════════════════════════════════════════════════════════
  // ORDER INFORMATION
  // ════════════════════════════════════════════════════════════════
  y = sectionHeader(doc, y, "Order Information");
  const invoiceUrl = order.payment?.invoiceUrl;
  const invoiceNumber =
    order.payment?.stripeInvoiceNumber || order._id?.substring(0, 7) || "—";
  const hasInvoiceLink = !!(invoiceUrl && order.payment?.stripeInvoiceNumber);
  const orderRows = [
    ["Invoice No.", invoiceNumber],
    ["Status", statusLabel],
    [
      "Order Type",
      order.orderType
        ? order.orderType.charAt(0).toUpperCase() + order.orderType.slice(1)
        : "—",
    ],
    ["Paid At", order.payment?.paidAt ? formatDate(order.payment.paidAt) : "—"],
  ];

  y = kvTable(
    doc,
    y,
    orderRows,
    (data) => {
      if (data.section !== "body" || data.column.index !== 1) return;

      // Invoice Number (Row 0)
      if (data.row.index === 0 && hasInvoiceLink) {
        data.cell.styles.textColor = C.brand;
        data.cell.styles.fontStyle = "bold";
      }

      // Status (Row 1)
      if (data.row.index === 1) {
        data.cell.styles.textColor = statusColor;
        data.cell.styles.fontStyle = "bold";
      }
    },
    hasInvoiceLink
      ? (data) => {
          if (
            data.section !== "body" ||
            data.row.index !== 0 ||
            data.column.index !== 1
          )
            return;
          doc.link(
            data.cell.x,
            data.cell.y,
            data.cell.width,
            data.cell.height,
            { url: invoiceUrl },
          );
        }
      : undefined,
  );

  // ════════════════════════════════════════════════════════════════
  // CUSTOMER
  // ════════════════════════════════════════════════════════════════
  y = ensureSpace(doc, y);
  y = sectionHeader(doc, y, "Customer");
  const customerRows = [
    ["Name", formatFullName(order.userId)],
    ["Email", safe(order.email)],
  ];
  if (order.shipping?.address?.phone) {
    customerRows.push([
      "Contact No.",
      formatPhone(order.shipping.address.phone),
    ]);
  }
  y = kvTable(doc, y, customerRows);

  // ════════════════════════════════════════════════════════════════
  // SHIPPING ADDRESS
  // ════════════════════════════════════════════════════════════════
  if (order.shipping?.address) {
    y = ensureSpace(doc, y);
    y = sectionHeader(doc, y, "Shipping Address");
    const addr = order.shipping.address;
    const fullAddress =
      [
        addr.line1,
        addr.line2,
        addr.city,
        addr.state,
        addr.postalCode,
        addr.country,
      ]
        .filter(Boolean)
        .join(", ") || "—";
    const addrRows = [
      ["Recipient", safe(addr.name)],
      ["Address", fullAddress],
    ];
    if (addr.phone) addrRows.push(["Contact No.", formatPhone(addr.phone)]);
    y = kvTable(doc, y, addrRows);
  }

  // ════════════════════════════════════════════════════════════════
  // BILLING DETAILS
  // ════════════════════════════════════════════════════════════════
  if (order.billing?.cardHolderName || order.billing?.country) {
    y = ensureSpace(doc, y);
    y = sectionHeader(doc, y, "Billing Details");
    y = kvTable(doc, y, [
      ["Cardholder", safe(order.billing?.cardHolderName)],
      ["Country", safe(order.billing?.country)],
    ]);
  }

  // ════════════════════════════════════════════════════════════════
  // SHIPPING & TRACKING
  // ════════════════════════════════════════════════════════════════
  if (order.shipping?.carrier) {
    y = ensureSpace(doc, y);
    y = sectionHeader(doc, y, "Tracking Information");
    const tr = order.shipping || {};
    const trackingRows = [
      ["Carrier", safe(tr.carrier)],
      ["Tracking No.", safe(tr.trackingNumber)],
    ];
    const trackingLink = tr.trackingLink;
    const linkRowIndex = trackingRows.length;
    trackingRows.push(["Tracking Link", safe(trackingLink)]);

    y = kvTable(
      doc,
      y,
      trackingRows,
      trackingLink
        ? (data) => {
            if (
              data.section !== "body" ||
              data.row.index !== linkRowIndex ||
              data.column.index !== 1
            )
              return;
            data.cell.styles.textColor = C.brand;
          }
        : undefined,
      trackingLink
        ? (data) => {
            if (
              data.section !== "body" ||
              data.row.index !== 2 ||
              data.column.index !== 1
            )
              return;
            doc.link(
              data.cell.x,
              data.cell.y,
              data.cell.width,
              data.cell.height,
              { url: trackingLink },
            );
          }
        : undefined,
    );
  }

  // ════════════════════════════════════════════════════════════════
  // ORDER ITEMS
  // ════════════════════════════════════════════════════════════════
  if (isDealer) {
    doc.addPage();
    y = M;
  } else y = ensureSpace(doc, y, 45);
  y = sectionHeader(doc, y, isDealer ? "Order Details" : "Items");

  if (isDealer && order.dealerItems) {
    const di = order.dealerItems;

    // Bundle(s) + torso bags — one table per ordered bundle.
    const bundleList = di.bundles?.length
      ? di.bundles
      : di.bundle?.name
        ? [{ ...di.bundle, torsoBags: di.torsoBags ?? [] }]
        : [];

    for (const bundle of bundleList) {
      const torsoBags = bundle.torsoBags ?? [];

      // Row 0 = bundle, rows 1+ = torso bag entries
      const bundleBody = [
        [safe(bundle.name), formatCurrency(bundle.price)],
        ...torsoBags.map((tb) => [`${safe(tb.name)}`, `x${safe(tb.quantity)}`]),
      ];

      y = ensureSpace(doc, y, 22);
      y = itemsTable(
        doc,
        y,
        ["Bundle / Torso Bag", "Price / Qty"],
        bundleBody,
        {
          0: { halign: "left" },
          1: { halign: "right", cellWidth: 36 },
        },
        (data) => {
          if (data.section !== "body" || data.row.index === 0) return;
          // Torso bag sub-rows — muted + slightly smaller
          data.cell.styles.textColor = C.gray600;
          data.cell.styles.fontSize = 8.5;
          data.cell.styles.fontStyle = "normal";
        },
      );
    }

    // Add-ons (with images on sub-items)
    if (di.addons?.length > 0) {
      for (let ai = 0; ai < di.addons.length; ai++) {
        const addon = di.addons[ai];
        y += 2;
        y = ensureSpace(doc, y, 25);

        rect(doc, M, y, CONTENT_W, 8, C.accentLight);
        doc.setFontSize(9.5);
        doc.setFont("helvetica", "bold");
        rgb(doc, C.accent);
        const addonLabel =
          addon.quantity > 1 ? `${addon.name} x${addon.quantity}` : addon.name;
        doc.text(`${addonLabel}`, M + 4, y + 5.5);
        doc.setFont("helvetica", "normal");
        rgb(doc, C.gray600);
        const priceLabel =
          addon.totalPrice > 0 ? formatCurrency(addon.totalPrice) : "Free";
        doc.text(priceLabel, PAGE_W - M - 4, y + 5.5, { align: "right" });
        resetText(doc);
        y += 10;

        if (addon.subItems?.length > 0) {
          // Flash-sale lines, keyed by row: a chip over the thumbnail plus the
          // struck pre-sale figure under the unit price actually charged.
          const sales = {};
          addon.subItems.forEach((s, si) => {
            const info = flashSaleInfo(s);
            if (info) sales[si] = info;
          });

          y = itemsTableWithImages(
            doc,
            y,
            ["Item", "Color", "Bin", "Per Bag", "Bags", "Unit Price", "Total"],
            addon.subItems.map((s) => [
              safe(s.name),
              safe(s.colorName),
              safe(s.bin),
              s.piecesPerBag != null
                ? `${s.piecesPerBag} ${perBagUnit(s.category, s.piecesPerBag).replace("/bag", "")}`
                : "—",
              safe(s.qty),
              s.pricePerBag > 0 ? formatCurrency(s.pricePerBag) : "Free",
              s.totalPrice > 0 ? formatCurrency(s.totalPrice) : "Free",
            ]),
            addonImgs[ai] ?? {},
            {
              1: { halign: "left", cellWidth: 38 },
              2: { halign: "left", cellWidth: 28 },
              3: { halign: "left", cellWidth: 26 },
              4: { halign: "center", cellWidth: 22 },
              5: { halign: "center", cellWidth: 14 },
              6: { halign: "center", cellWidth: 22 },
              7: { halign: "center", cellWidth: 20 },
            },
            // Reduce padding on numeric columns (4-7) in both head and body
            (data) => {
              if (data.column.index < 4) return;
              data.cell.styles.cellPadding = {
                top: 3,
                bottom: 3,
                left: 2,
                right: 2,
              };
            },
            Object.fromEntries(
              Object.entries(sales).map(([si, info]) => [
                si,
                `${info.percentOff}% OFF`,
              ]),
            ),
            // Column 6 is Unit Price (column 0 is the image).
            (data) => {
              if (data.column.index !== 6) return;
              const info = sales[data.row.index];
              if (info) {
                drawStruckPrice(
                  doc,
                  data.cell,
                  formatCurrency(info.originalPrice),
                );
              }
            },
          );
        }
      }
    }

    // Extra bags
    if (di.extraBags?.length > 0) {
      y += 2;
      y = ensureSpace(doc, y, 22);
      y = itemsTable(
        doc,
        y,
        ["Extra Bag", "Qty", "Unit Price", "Total"],
        di.extraBags.map((eb) => [
          safe(eb.name),
          safe(eb.quantity),
          formatCurrency(eb.price),
          formatCurrency(eb.totalPrice ?? eb.price * eb.quantity),
        ]),
        {
          0: { halign: "left" },
          1: { halign: "center", cellWidth: 22 },
          2: { halign: "center", cellWidth: 34 },
          3: { halign: "center", cellWidth: 34 },
        },
      );
    }
  } else if (order.productItems?.length > 0) {
    // Discounted lines, keyed by row: a chip over the thumbnail plus the struck
    // pre-discount figure under the unit price actually charged — the same
    // treatment the dealer add-on table gives a flash sale.
    const drops = {};
    order.productItems.forEach((item, i) => {
      const info = priceDropInfo(item.basePrice, item.unitPrice);
      if (info) drops[i] = info;
    });

    y = itemsTableWithImages(
      doc,
      y,
      ["Product", "Color", "Qty", "Unit Price", "Total"],
      order.productItems.map((item) => {
        const { name, colorName } = splitProductItemName(item);
        return [
          safe(name),
          safe(colorName),
          safe(item.quantity),
          formatCurrency(item.unitPrice),
          formatCurrency(item.totalPrice),
        ];
      }),
      productImgs,
      {
        1: { halign: "left" },
        2: { halign: "left", cellWidth: 34 },
        3: { halign: "center", cellWidth: 18 },
        // Centred like the dealer table so the struck pre-discount price sits
        // directly under the amount charged.
        4: { halign: "center", cellWidth: 26 },
        5: { halign: "center", cellWidth: 26 },
      },
      undefined,
      Object.fromEntries(
        Object.entries(drops).map(([i, info]) => [i, `${info.percentOff}% OFF`]),
      ),
      // Column 4 is Unit Price (column 0 is the image).
      (data) => {
        if (data.column.index !== 4) return;
        const info = drops[data.row.index];
        if (info) {
          drawStruckPrice(doc, data.cell, formatCurrency(info.originalPrice));
        }
      },
    );
  }

  // ════════════════════════════════════════════════════════════════
  // REFUND DETAILS (If Cancelled)
  // ════════════════════════════════════════════════════════════════
  if (order.status === "cancelled") {
    y += 4;
    y = ensureSpace(doc, y, 45);
    y = sectionHeader(doc, y, "Refund Details");

    const refundRows = [];
    if (order.refund?.stripeRefundId) {
      refundRows.push(["Refund ID", safe(order.refund.stripeRefundId)]);
    }
    if (order.refund?.status === "completed" && order.refund?.arn) {
      refundRows.push(["ARN", safe(order.refund.arn)]);
    }
    refundRows.push(
      [
        "Cancelled On",
        formatDate(order.cancellation?.cancelledAt || order.updatedAt),
      ],
      [
        "Cancelled By",
        order.cancellation?.cancelledById
          ? formatFullName(order.cancellation.cancelledById)
          : order.cancellation?.cancelledByRole === "admin"
            ? "Admin"
            : "Customer",
      ],
      ["Reason", safe(order.cancellation?.reason)],
    );
    if (order.cancellation?.notes) {
      refundRows.push(["Notes", safe(order.cancellation.notes)]);
    }

    y = kvTable(doc, y, refundRows);
  }

  // ════════════════════════════════════════════════════════════════
  // PAYMENT SUMMARY
  // ════════════════════════════════════════════════════════════════
  y += 4;
  y = ensureSpace(doc, y, 45);
  y = sectionHeader(doc, y, "Payment Summary");

  const totalLabel = order.status === "cancelled" ? "REFUND AMOUNT" : "TOTAL";
  const summaryRows = [
    ["Subtotal", formatCurrency(order.payment?.subtotal)],
    ["Shipping Fee", formatCurrency(order.payment?.shippingFee)],
  ];
  if (order.payment?.shippingInsurance > 0) {
    summaryRows.push([
      "Shipping Insurance (0.5%)",
      formatCurrency(order.payment.shippingInsurance),
    ]);
  }
  summaryRows.push(["Sales Tax", formatCurrency(order.payment?.taxAmount)]);
  let discountRowIndex = -1;
  let discountCodeText = "";
  if (order.payment?.discount?.amount > 0) {
    const d = order.payment.discount;
    let label = d.couponName || "Discount";
    if (d.percentOff) label += ` (${d.percentOff}% off)`;
    else if (d.amountOff) label += ` (${formatCurrency(d.amountOff)} off)`;
    if (d.promotionCode) discountCodeText = `Code: ${d.promotionCode}`;
    discountRowIndex = summaryRows.length;
    summaryRows.push([label, `-${formatCurrency(d.amount)}`]);
  }
  summaryRows.push([
    totalLabel,
    formatCurrency(order.refund?.amount || order.payment?.totalAmount),
  ]);

  const totalRowIndex = summaryRows.length - 1;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    tableWidth: CONTENT_W,
    theme: "plain",
    styles: {
      fontSize: 10,
      cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
      overflow: "linebreak",
      lineColor: C.gray200,
      lineWidth: 0.2,
      valign: "middle",
    },
    alternateRowStyles: { fillColor: C.gray100 },
    columnStyles: {
      0: {
        fontStyle: "bold",
        textColor: C.gray600,
        cellWidth: 64,
        fontSize: 9,
        halign: "left",
      },
      1: { textColor: C.gray900, halign: "right" },
    },
    body: summaryRows,
    didParseCell: (data) => {
      if (data.section !== "body") return;

      // Discount row: reserve extra height and top-align so the code line fits below
      if (data.row.index === discountRowIndex && discountCodeText) {
        data.cell.styles.minCellHeight = 14;
        data.cell.styles.valign = "top";
      }

      // Style Total at the bottom
      if (data.row.index === totalRowIndex) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 14;
        if (data.column.index === 1) {
          data.cell.styles.textColor =
            order.status === "cancelled" ? C.red : C.accentText;
        } else {
          data.cell.styles.textColor = C.gray900;
        }
      }
    },
    didDrawCell: (data) => {
      if (
        data.section !== "body" ||
        data.row.index !== discountRowIndex ||
        data.column.index !== 0 ||
        !discountCodeText
      )
        return;
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      rgb(doc, C.gray600);
      doc.text(
        discountCodeText,
        data.cell.x + 5,
        data.cell.y + data.cell.height - 3,
      );
      resetText(doc);
    },
  });
  y = doc.lastAutoTable.finalY + 6;

  doc.save(`order-${invoice}.pdf`);
};
