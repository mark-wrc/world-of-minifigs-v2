import {
  DELIVERY_METHODS,
  DELIVERY_METHOD_LABELS,
  getPaymentGatewayLabel,
} from "../../constants/orderConstants.js";

const appName = () => process.env.SMTP_FROM_NAME || "World of Minifigs";
const supportEmail = () => process.env.SMTP_FROM_EMAIL || "";
const frontendUrl = () => process.env.FRONTEND_URL || "";

const fmt = (n) =>
  n != null
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(n)
    : "—";

const formatDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  return (
    date.toLocaleDateString("en-US", { dateStyle: "long" }) +
    " at " +
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  );
};

// ── Base wrapper ───────────────────────────────────────────────────────────────
// accentColor controls the top border stripe per template

const wrapAdmin = (body, accentColor = "#2563eb") => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${appName()}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
    <tr><td align="center" style="padding:40px 16px 48px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px;background-color:#ffffff;border-radius:12px;border-top:5px solid ${accentColor};border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
        ${body}
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const wrap = (body, accentColor = "#0ea5e9") => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${appName()}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
    <tr><td align="center" style="padding:40px 16px 48px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px;background-color:#ffffff;border-radius:12px;border-top:5px solid ${accentColor};border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">

        ${body}

        <!-- Footer -->
        <tr><td align="center" style="padding:20px 32px 28px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;line-height:1.8;">
          Need help? Email us at <a href="mailto:${supportEmail()}" style="color:#64748b;text-decoration:none;">${supportEmail()}</a><br>
          &copy; ${new Date().getFullYear()} ${appName()}. All rights reserved.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ── Shared helpers ─────────────────────────────────────────────────────────────

const orderRef = (order) =>
  order.payment?.receiptNumber ||
  order.payment?.stripeInvoiceNumber ||
  String(order._id).substring(0, 7).toUpperCase();

// Invoice number as text
const invoiceLink = (order) =>
  `<span style="color:#0f172a;font-weight:600;">${orderRef(order)}</span>`;

const viewOrderBtn = (order) =>
  `<tr><td align="center" style="padding:8px 32px 28px;">
    <a href="${frontendUrl()}/checkout/success?order_id=${order._id}" style="display:inline-block;padding:14px 36px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14.5px;letter-spacing:0.01em;">View My Order &rarr;</a>
  </td></tr>`;

// A shipment has no page of its own — it lives on My Orders as one card, so
// the button opens My Orders with that shipment expanded.
const viewShipmentBtn = (shipment) =>
  `<tr><td align="center" style="padding:8px 32px 28px;">
    <a href="${frontendUrl()}/purchase?shipment=${shipment._id}" style="display:inline-block;padding:14px 36px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14.5px;letter-spacing:0.01em;">View My Shipment &rarr;</a>
  </td></tr>`;

// Two-column label/value row — table cells so Gmail renders correctly
const kv = (label, value, isLast = false, valueStyle = "") =>
  `<tr>
    <td style="font-size:13.5px;color:#64748b;font-weight:500;padding:7px 0;width:44%;${isLast ? "" : "border-bottom:1px solid #f1f5f9;"}">${label}</td>
    <td align="right" style="font-size:13.5px;color:#0f172a;font-weight:500;padding:7px 0;text-align:right;${isLast ? "" : "border-bottom:1px solid #f1f5f9;"}${valueStyle}">${value}</td>
  </tr>`;

// Section: blue title outside the box, content inside a bordered box
// divider: true adds a thin top separator line before the title (use for first section after header)
const openSection = (title, content, { divider = true } = {}) =>
  `<tr><td style="padding:0 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="${divider ? "border-top:1px solid #f1f5f9;" : ""}padding:12px 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#3b82f6;">${title}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:0 32px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:10px;">
      <tr><td style="padding:12px 18px;">
        ${content}
      </td></tr>
    </table>
  </td></tr>`;

// ── Items table ────────────────────────────────────────────────────────────────

const buildItemsHtml = (order) => {
  let rows = "";

  if (
    (order.orderType === "dealer" || order.orderType === "wholesale") &&
    order.dealerItems
  ) {
    const di = order.dealerItems;
    const allRows = [];

    // Multi-bundle orders; fall back to the legacy single-bundle shape.
    const bundleList = di.bundles?.length
      ? di.bundles
      : di.bundle?.name
        ? [{ ...di.bundle, torsoBags: di.torsoBags || [] }]
        : [];

    bundleList.forEach((bundle) => {
      allRows.push({
        type: "main",
        name: bundle.name,
        value: fmt(bundle.price),
      });

      (bundle.torsoBags || []).forEach((tb) => {
        allRows.push({
          type: "sub",
          name: tb.name,
          value: `&times;${tb.quantity}`,
        });
      });
    });

    di.addons?.forEach((a) => {
      allRows.push({
        type: "main",
        name:
          a.quantity > 1
            ? `${a.name} <span style="color:#94a3b8;font-size:12px;">&times;${a.quantity}</span>`
            : a.name,
        value:
          a.totalPrice > 0
            ? fmt(a.totalPrice)
            : '<span style="color:#16a34a;font-weight:600">Free</span>',
      });
    });

    di.extraBags?.forEach((eb) => {
      allRows.push({
        type: "main",
        name: `${eb.name} <span style="color:#94a3b8;font-size:12px;">&times;${eb.quantity}</span>`,
        value: fmt(eb.totalPrice ?? eb.price * eb.quantity),
      });
    });

    allRows.forEach((row, idx) => {
      const isLast = idx === allRows.length - 1;
      const border = isLast ? "" : "border-bottom:1px solid #f1f5f9;";
      if (row.type === "main") {
        rows += `<tr>
          <td colspan="2" style="font-size:13.5px;color:#334155;padding:10px 0;${border}">${row.name}</td>
          <td align="right" style="font-size:13.5px;font-weight:600;color:#0f172a;padding:10px 0;${border}text-align:right;white-space:nowrap;">${row.value}</td>
        </tr>`;
      } else {
        rows += `<tr>
          <td colspan="2" style="font-size:12.5px;color:#94a3b8;padding:5px 0 5px 16px;${border}">&#8627; ${row.name}</td>
          <td align="right" style="font-size:12.5px;color:#94a3b8;padding:5px 0;${border}text-align:right;">${row.value}</td>
        </tr>`;
      }
    });

    return openSection(
      "Order Details",
      `<table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <th colspan="2" align="left" style="padding:0 0 8px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e2e8f0;text-align:left;">Item</th>
          <th align="right" style="padding:0 0 8px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;">Price / Qty</th>
        </tr>
        ${rows}
      </table>`,
      { divider: false },
    );
  }

  if (order.productItems?.length > 0) {
    order.productItems.forEach((item, idx) => {
      const isLast = idx === order.productItems.length - 1;
      const border = isLast ? "" : "border-bottom:1px solid #f1f5f9;";
      rows += `<tr>
        <td style="font-size:13.5px;color:#334155;padding:10px 0;${border}">${item.productName}</td>
        <td align="center" style="font-size:13.5px;color:#64748b;padding:10px 0;${border}text-align:center;">&times;${item.quantity}</td>
        <td align="right" style="font-size:13.5px;font-weight:600;color:#0f172a;padding:10px 0;${border}text-align:right;white-space:nowrap;">${fmt(item.totalPrice)}</td>
      </tr>`;
    });

    return openSection(
      "Order Details",
      `<table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <th align="left" style="padding:0 0 8px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e2e8f0;text-align:left;">Product</th>
          <th align="center" style="padding:0 0 8px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e2e8f0;text-align:center;">Qty</th>
          <th align="right" style="padding:0 0 8px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e2e8f0;text-align:right;">Total</th>
        </tr>
        ${rows}
      </table>`,
      { divider: false },
    );
  }

  return "";
};

// ── Section helpers ────────────────────────────────────────────────────────────

const refundSection = (order) => {
  if (order.status !== "cancelled") return "";
  const cancelledBy =
    order.cancellation?.cancelledByRole === "admin"
      ? "Support Team"
      : "Customer";
  const rows = [
    kv(
      "Cancelled On",
      formatDate(order.cancellation?.cancelledAt || order.updatedAt),
    ),
    kv("Cancelled By", cancelledBy),
    kv("Reason", order.cancellation?.reason || "—"),
    order.cancellation?.notes
      ? kv("Notes", order.cancellation.notes, true)
      : "",
  ]
    .filter(Boolean)
    .join("");

  return openSection(
    "Cancellation Details",
    `<table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`,
    { divider: false },
  );
};

const buildPaymentSummaryHtml = (order, { totalColor = "#0f172a" } = {}) => {
  const p = order.payment || {};
  const isCancelled = order.status === "cancelled";
  const refundAmount = order.refund?.amount ?? p.totalAmount;
  const hasBreakdown =
    p.subtotal != null || p.shippingFee != null || p.taxAmount != null;

  // A held order pays its shipping later, when the parcel ships.
  const isHeld = order.status === "on_hold";

  let rows = "";
  if (hasBreakdown) {
    rows += kv("Subtotal", fmt(p.subtotal));
    if (!isHeld) {
      rows += kv(
        "Shipping Fee",
        p.shippingFee != null ? fmt(p.shippingFee) : "—",
      );
    }
    if (p.shippingInsurance > 0) {
      rows += kv("Shipping Insurance (0.5%)", fmt(p.shippingInsurance));
    }
    rows += kv("Sales Tax", p.taxAmount != null ? fmt(p.taxAmount) : "—");
  }

  if (p.discount?.amount > 0) {
    const d = p.discount;
    let topLine = d.couponName || "Discount";
    if (d.percentOff) topLine += ` (${d.percentOff}% off)`;
    else if (d.amountOff) topLine += ` (${fmt(d.amountOff)} off)`;
    const codeLine = d.promotionCode
      ? `<br/><span style="font-size:11px;color:#94a3b8;font-weight:400;">Code: ${d.promotionCode}</span>`
      : "";
    rows += kv(`${topLine}${codeLine}`, `-${fmt(d.amount)}`);
  }

  const label = isCancelled ? "Refund Amount" : "Total";
  const color = isCancelled ? "#dc2626" : totalColor;

  rows += kv(
    label,
    fmt(isCancelled ? refundAmount : p.totalAmount),
    true,
    `font-weight:700;font-size:15px;color:${color};`,
  );

  return openSection(
    "Payment Summary",
    `<table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`,
    { divider: false },
  );
};

const trackingSection = (order) => {
  const tr = order.shipping || {};
  const rows = [
    kv("Carrier", tr.carrier || "—"),
    kv("Tracking No.", tr.trackingNumber || "—"),
    tr.trackingLink
      ? kv(
          "Tracking Link",
          `<a href="${tr.trackingLink}" style="color:#2563eb;text-decoration:underline;word-break:break-all;">${tr.trackingLink}</a>`,
          true,
        )
      : kv("Tracking Link", "—", true),
  ]
    .filter(Boolean)
    .join("");

  return openSection(
    "Tracking Information",
    `<table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`,
    {
      divider: false,
    },
  );
};

const deliverySection = (order) => {
  const d = order.delivery || {};
  const rows = [
    kv("Method", DELIVERY_METHOD_LABELS[d.method] || "—"),
    d.receivedBy ? kv("Received By", d.receivedBy) : "",
    kv("Delivered On", formatDate(d.deliveredAt || order.updatedAt), !d.notes),
    d.notes ? kv("Notes", d.notes, true) : "",
  ]
    .filter(Boolean)
    .join("");

  return openSection(
    "Delivery Details",
    `<table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`,
    { divider: false },
  );
};

// ── Templates ──────────────────────────────────────────────────────────────────

export const getAdminNewOrderTemplate = (order, customerName) => {
  const customer = customerName || order.email || "a customer";

  return wrapAdmin(
    `
    <tr><td align="center" style="padding:32px 32px 24px;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;">New Order Received</h1>
      <p style="margin:0;font-size:14px;color:#64748b;">A new order has been placed by <strong style="color:#0f172a;">${customer}</strong>.</p>
    </td></tr>
    ${openSection(
      "Order Information",
      `<table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${kv("Invoice Number", invoiceLink(order))}
        ${kv("Customer", customer)}
        ${kv("Order Type", `<span style="text-transform:capitalize;">${order.orderType || "product"}</span>`)}
        ${kv("Shipping", shippingPlanLabel(order))}
        ${kv("Paid With", getPaymentGatewayLabel(order), true)}
      </table>`,
      { divider: false },
    )}
    ${buildItemsHtml(order)}
    ${buildPaymentSummaryHtml(order, { totalColor: "#16a34a" })}
  `,
  );
};

// ── Pay Now, Ship Later ───────────────────────────────────────────────────────

const shippingPlanLabel = (order) => {
  if (order.status === "on_hold") {
    return `<span style="color:#d97706;font-weight:600;">Held &mdash; ship later</span>`;
  }
  if (order.shipmentId) {
    return `<span style="color:#2563eb;font-weight:600;">Ships with held orders</span>`;
  }
  return "Ship now";
};

const shipmentOrdersHtml = (orders) => {
  const rows = orders
    .map((order, i) =>
      kv(
        `${orderRef(order)} <span style="color:#94a3b8;text-transform:capitalize;">&middot; ${order.orderType || "product"}</span>`,
        fmt(order.payment?.totalAmount),
        i === orders.length - 1,
      ),
    )
    .join("");
  return openSection(
    `Orders in this Shipment (${orders.length})`,
    `<table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`,
    { divider: false },
  );
};

const shipmentAddressHtml = (address) => {
  if (!address?.line1) return "";
  // One-line address, the way the admin order view shows it.
  const fullAddress = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
  return openSection(
    "Ship To",
    `<table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${kv("Recipient", address.name || "—")}
      ${kv("Address", fullAddress, !address.phone)}
      ${address.phone ? kv("Contact No.", address.phone, true) : ""}
    </table>`,
    { divider: false },
  );
};

export const getAdminShipmentReadyTemplate = (
  shipment,
  orders,
  customerName,
) => {
  const customer = customerName || shipment.email || "a customer";
  const reviewHtml = shipment.reviewNote
    ? `<tr><td style="padding:0 32px 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:10px;">
        <tr><td style="padding:14px 18px;font-size:13.5px;color:#7f1d1d;line-height:1.6;">${shipment.reviewNote}</td></tr>
      </table>
    </td></tr>`
    : "";

  return wrapAdmin(
    `
    <tr><td align="center" style="padding:32px 32px 24px;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;">Consolidated Shipment Ready to Pack</h1>
      <p style="margin:0;font-size:14px;color:#64748b;"><strong style="color:#0f172a;">${customer}</strong> paid to ship ${orders.length} orders together in one parcel.</p>
    </td></tr>
    ${reviewHtml}
    ${openSection(
      "Shipping Payment",
      `<table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${kv("Paid With", getPaymentGatewayLabel(shipment))}
        ${kv("Flat Rate", fmt(shipment.payment?.shippingFee), !(shipment.payment?.shippingInsurance > 0))}
        ${shipment.payment?.shippingInsurance > 0 ? kv("Shipping Insurance (0.5%)", fmt(shipment.payment.shippingInsurance), true) : ""}
      </table>`,
      { divider: false },
    )}
    ${shipmentOrdersHtml(orders)}
    ${shipmentAddressHtml(shipment.shipping?.address)}
  `,
  );
};

export const getShipmentShippedTemplate = (shipment, orders) =>
  wrap(
    `
    <tr><td align="center" style="padding:32px 32px 24px;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;">Your orders are on their way!</h1>
      <p style="margin:0;font-size:14px;color:#64748b;">Your ${orders.length} order${orders.length === 1 ? " has" : "s have"} been packed together and handed off to the carrier.</p>
    </td></tr>
    ${trackingSection(shipment)}
    ${shipmentOrdersHtml(orders)}
    ${viewShipmentBtn(shipment)}
  `,
    "#0ea5e9",
  );

export const getShippingNotificationTemplate = (order) =>
  wrap(
    `
    <tr><td align="center" style="padding:32px 32px 24px;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;">Your order is on its way!</h1>
      <p style="margin:0;font-size:14px;color:#64748b;">Your package has been handed off to the carrier and is heading your way.</p>
    </td></tr>
    ${openSection(
      "Order Information",
      `<table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${kv("Invoice Number", invoiceLink(order))}
        ${kv("Status", `<span style="color:#2563eb;font-weight:600;">Shipped</span>`)}
        ${kv("Paid With", getPaymentGatewayLabel(order), true)}
      </table>`,
      { divider: false },
    )}
    ${trackingSection(order)}
    ${buildItemsHtml(order)}
    ${buildPaymentSummaryHtml(order, { totalColor: "#16a34a" })}
    ${viewOrderBtn(order)}
  `,
    "#0ea5e9",
  );

export const getOrderDeliveredTemplate = (order) => {
  const isPickup = order.delivery?.method === DELIVERY_METHODS.STORE_PICKUP;
  const intro = isPickup
    ? "Your order has been picked up in store. Thank you for stopping by!"
    : "Your order has been hand delivered. Thank you for your purchase!";

  return wrap(
    `
    <tr><td align="center" style="padding:32px 32px 24px;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;">Your order has been delivered!</h1>
      <p style="margin:0;font-size:14px;color:#64748b;">${intro}</p>
    </td></tr>
    ${openSection(
      "Order Information",
      `<table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${kv("Invoice Number", invoiceLink(order))}
        ${kv("Status", `<span style="color:#16a34a;font-weight:600;">Delivered</span>`)}
        ${kv("Paid With", getPaymentGatewayLabel(order), true)}
      </table>`,
      { divider: false },
    )}
    ${deliverySection(order)}
    ${buildItemsHtml(order)}
    ${buildPaymentSummaryHtml(order, { totalColor: "#16a34a" })}
    ${viewOrderBtn(order)}
  `,
    "#16a34a",
  );
};

export const getOrderCancelledTemplate = (order) =>
  wrap(
    `
    <tr><td align="center" style="padding:32px 32px 24px;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;">Order Cancelled</h1>
      <p style="margin:0;font-size:14px;color:#64748b;">Your order has been cancelled and a refund has been initiated.</p>
    </td></tr>
    <tr><td style="padding:0 32px 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:10px;">
        <tr><td style="padding:14px 18px;font-size:13.5px;color:#78350f;line-height:1.6;">
          &#9203;&nbsp; A refund of <strong style="color:#92400e;">${fmt(order.refund?.amount ?? order.payment?.totalAmount)}</strong> has been initiated to your original payment method. Depending on your bank, this may take <strong style="color:#92400e;">5&ndash;10 business days</strong> to appear on your statement.
        </td></tr>
      </table>
    </td></tr>
    ${openSection(
      "Order Information",
      `<table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${kv("Invoice Number", invoiceLink(order))}
        ${kv("Status", `<span style="color:#dc2626;font-weight:600;">Cancelled</span>`)}
        ${kv("Paid With", getPaymentGatewayLabel(order), true)}
      </table>`,
      { divider: true },
    )}
    ${buildItemsHtml(order)}
    ${refundSection(order)}
    ${buildPaymentSummaryHtml(order, { totalColor: "#0f172a" })}
    ${viewOrderBtn(order)}
  `,
    "#ef4444",
  );
