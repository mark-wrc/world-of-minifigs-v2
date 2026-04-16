import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  formatCurrency,
  formatDate,
  formatFullName,
  formatPhone,
} from "@/utils/formatting";
import { getOrderStatusConfig } from "@/constant/orderData";

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
  delivered: C.accentText,
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

const ensureSpace = (doc, y, needed = 35) => {
  if (y + needed > 282) {
    doc.addPage();
    return M;
  }
  return y;
};

const fetchImageAsBase64 = (url, maxPx = 150) => {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1));
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
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
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
    },
    bodyStyles: {
      fontSize: 9.5,
      cellPadding: { top: 3.5, bottom: 3, left: 5, right: 5 },
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
const itemsTableWithImages = (
  doc,
  y,
  head,
  body,
  imgs,
  colStyles = {},
  onParseCell,
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
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
    },
    bodyStyles: {
      fontSize: 9.5,
      cellPadding: { top: 2, bottom: 2, left: 5, right: 5 },
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
      if (data.column.index !== 0 || data.section !== "body") return;
      const img = imgs[data.row.index];
      if (!img) return;
      const cx = data.cell.x + (data.cell.width - IMG_SIZE) / 2;
      const cy = data.cell.y + (data.cell.height - IMG_SIZE) / 2;
      try {
        doc.addImage(img, "PNG", cx, cy, IMG_SIZE, IMG_SIZE);
      } catch {
        /* skip */
      }
    },
  });
  return doc.lastAutoTable.finalY + 6;
};

// ── Main export ───────────────────────────────────────────────────────────────
export const exportOrderToPdf = async (order) => {
  if (!order) return;

  const isDealer = order.orderType === "dealer";

  // Pre-fetch images
  const productImgs = {};
  if (!isDealer && order.productItems?.length > 0) {
    await Promise.all(
      order.productItems.map(async (item, i) => {
        if (item.imageUrl)
          productImgs[i] = await fetchImageAsBase64(item.imageUrl);
      }),
    );
  }

  const addonImgs = {};
  if (isDealer && order.dealerItems?.addons?.length > 0) {
    await Promise.all(
      order.dealerItems.addons.map(async (addon, ai) => {
        addonImgs[ai] = {};
        if (addon.subItems?.length > 0) {
          await Promise.all(
            addon.subItems.map(async (sub, si) => {
              if (sub.imageUrl)
                addonImgs[ai][si] = await fetchImageAsBase64(sub.imageUrl);
            }),
          );
        }
      }),
    );
  }

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
    [
      "Paid At",
      order.payment?.paidAt ? formatDate(order.payment.paidAt) : "—",
    ],
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
    const addrRows = [
      ["Recipient", safe(addr.name)],
      ["Street", [addr.line1, addr.line2].filter(Boolean).join(", ") || "—"],
      ["City", safe(addr.city)],
      ["State", safe(addr.state)],
      ["Postal Code", safe(addr.postalCode)],
      ["Country", safe(addr.country)],
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

    // Bundle + torso bags combined into one table
    if (di.bundle) {
      const torsoBags = di.torsoBags ?? [];

      // Row 0 = bundle, rows 1+ = torso bag entries
      const bundleBody = [
        [safe(di.bundle.name), formatCurrency(di.bundle.price)],
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
        doc.text(`${addon.name}`, M + 4, y + 5.5);
        doc.setFont("helvetica", "normal");
        rgb(doc, C.gray600);
        const priceLabel =
          addon.totalPrice > 0 ? formatCurrency(addon.totalPrice) : "Free";
        doc.text(priceLabel, PAGE_W - M - 4, y + 5.5, { align: "right" });
        resetText(doc);
        y += 10;

        if (addon.subItems?.length > 0) {
          const isMinifig = /minifig/i.test(addon.name);
          const qtyLabel = isMinifig ? "Minifigs" : "Bags";
          y = itemsTableWithImages(
            doc,
            y,
            ["Item", "Color", qtyLabel, "Unit Price", "Total"],
            addon.subItems.map((s) => [
              safe(s.name),
              safe(s.colorName),
              safe(s.qty),
              s.pricePerBag > 0 ? formatCurrency(s.pricePerBag) : "Free",
              s.totalPrice > 0 ? formatCurrency(s.totalPrice) : "Free",
            ]),
            addonImgs[ai] ?? {},
            {
              1: { halign: "left" },
              2: { halign: "left", cellWidth: 40 },
              3: { halign: "center", cellWidth: isMinifig ? 22 : 14 },
              4: { halign: "center", cellWidth: 24 },
              5: { halign: "center", cellWidth: 22 },
            },
            // Reduce padding on numeric columns (3-5) in both head and body
            (data) => {
              if (data.column.index < 3) return;
              data.cell.styles.cellPadding = {
                top: 3,
                bottom: 3,
                left: 2,
                right: 2,
              };
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
    y = itemsTableWithImages(
      doc,
      y,
      ["Product", "Qty", "Unit Price", "Total"],
      order.productItems.map((item) => [
        safe(item.productName),
        safe(item.quantity),
        formatCurrency(item.unitPrice),
        formatCurrency(item.totalPrice),
      ]),
      productImgs,
      {
        1: { halign: "left" },
        2: { halign: "center", cellWidth: 22 },
        3: { halign: "right", cellWidth: 34 },
        4: { halign: "right", cellWidth: 34 },
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
    ["Sales Tax", formatCurrency(order.payment?.taxAmount)],
    [
      totalLabel,
      formatCurrency(order.refund?.amount || order.payment?.totalAmount),
    ],
  ];

  const totalRowIndex = summaryRows.length - 1;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    tableWidth: CONTENT_W,
    theme: "plain",
    styles: {
      fontSize: 10,
      cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
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
  });
  y = doc.lastAutoTable.finalY + 6;

  doc.save(`order-${invoice}.pdf`);
};
