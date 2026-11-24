import React from "react";
import {
  Archive,
  Boxes,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AdminManagementHeader from "@/components/shared/AdminManagementHeader";
import TableLayout from "@/components/table/TableLayout";
import { exportOrderToPdf, exportShipmentToPdf } from "@/utils/exportOrderPdf";
import {
  ActionsColumn,
  TableCell,
  TimestampCells,
  PriceCell,
} from "@/components/table/BaseColumn";
import AddUpdateItemDialog from "@/components/table/AddUpdateItemDialog";
import {
  AdminFormInput,
  AdminFormTextarea,
  AdminFormSelect,
} from "@/components/shared/AdminFormInput";
import { Badge } from "@/components/ui/badge";
import ViewAdminDialog from "@/components/table/ViewAdminDialog";
import {
  formatCurrency,
  formatDate,
  display,
  formatFullName,
  formatPhone,
} from "@/utils/formatting";
import {
  getOrderStatusConfig,
  getDeliveryMethodLabel,
  splitProductItemName,
  getInvoiceNumber,
  getInvoiceUrl,
  getRefundId,
  getPaymentGatewayLabel,
  getOrderShipment,
  getShipmentRef,
  getShipmentStatusConfig,
  CONSOLIDATED_FILTER,
  BACKORDER_FILTER,
  STATUS_CONFIG,
  getRefundLimit,
} from "@/constant/orderData";
import {
  getAwaitingBackorders,
  hasAwaitingBackorder,
  getRefundedTotal,
  getBackorderShipments,
  getOrderLines,
} from "@shared/orderLines";
import OrderRefunds from "@/components/shared/OrderRefunds";
import RefundDialog from "@/components/admin/orders/RefundDialog";
import { useRestockOrderRefundMutation } from "@/redux/api/adminApi";
import { handleApiError, handleApiSuccess } from "@/utils/apiHelpers";
import BackorderShipments from "@/components/shared/BackorderShipments";
import {
  BackorderDialog,
  ShipBackorderDialog,
  BackorderReportDialog,
} from "@/components/admin/orders/BackorderDialogs";
import useOrderManagement from "@/hooks/admin/useOrderManagement";
import OrderItemRow from "@/components/shared/OrderItemRow";
import { perBagUnit } from "@shared/inventoryData";

// Small inline button that copies the given text and briefly shows a check.
// The recipient's name and shipping address as lines, ready to paste onto a
// label: name, street, (unit), "City, ST 12345", country.
const shipToText = (address) => {
  if (!address) return "";
  const cityLine = [
    address.city,
    [address.state, address.postalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  return [address.name, address.line1, address.line2, cityLine, address.country]
    .filter(Boolean)
    .join("\n");
};

const CopyButton = ({ value, label = "Address" }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy ${label.toLowerCase()}`}
      className="inline-flex shrink-0 cursor-pointer items-center text-blue-600 transition-colors hover:text-blue-700"
    >
      {copied ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
};

const OrderManagement = () => {
  const {
    page,
    limit,
    search,
    orderGroups,
    expandedShipments,
    toggleShipment,
    totalItems,
    totalPages,
    startItem,
    endItem,
    handlePrevious,
    handleNext,
    columns,
    isLoadingOrders,
    statusModalOpen,
    selectedOrder,
    allowedStatuses,
    newStatus,
    carrier,
    trackingNumber,
    trackingLink,
    cancelReason,
    cancelNotes,
    deliveryMethod,
    receivedBy,
    deliveryNotes,
    deliveryMethodOptions,
    isUpdatingStatus,
    viewModalOpen,
    viewOrder,
    viewShipment,
    handleViewShipment,
    handleViewShipmentChange,
    orderReference,
    handlePageChange,
    handleLimitChange,
    handleSearchChange,
    setNewStatus,
    setCarrier,
    setTrackingNumber,
    setTrackingLink,
    setCancelReason,
    setCancelNotes,
    setDeliveryMethod,
    setReceivedBy,
    setDeliveryNotes,
    statusFilter,
    handleStatusFilterChange,
    handleEdit,
    handleView,
    getAvailableTransitions,
    isLoadingConfig,
    handleStatusModalChange,
    handleViewModalChange,
    handleStatusFormSubmit,
  } = useOrderManagement();

  const isSelectedHeld = selectedOrder?.status === "on_hold";

  // Backorders: which order each dialog is open for, and the report.
  const [backorderOrder, setBackorderOrder] = React.useState(null);
  const [shipBackorderOrder, setShipBackorderOrder] = React.useState(null);
  const [backorderReportOpen, setBackorderReportOpen] = React.useState(false);
  // The order views show a copy of the order from when it was opened; after a
  // backorder or refund change, show the saved backorder/refunds straight away.
  const [orderUpdates, setOrderUpdates] = React.useState({});
  const handleBackorderSaved = (orderId, backorders) =>
    setOrderUpdates((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], backorders: backorders || [] },
    }));
  const handleRefundSaved = (orderId, saved) =>
    setOrderUpdates((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        backorders: saved?.backorders || [],
        refunds: saved?.refunds || [],
      },
    }));
  const withBackorderUpdate = (order) =>
    order && orderUpdates[order._id]
      ? { ...order, ...orderUpdates[order._id] }
      : order;

  // Refunds without cancelling: which order the refund dialog is open for.
  const [refundOrder, setRefundOrder] = React.useState(null);
  const [restockOrderRefund] = useRestockOrderRefundMutation();
  const [restockingId, setRestockingId] = React.useState(null);
  const handleRestock = async (order, refund) => {
    setRestockingId(refund._id);
    try {
      const result = await restockOrderRefund({
        id: order._id,
        refundId: refund._id,
      }).unwrap();
      handleApiSuccess(result, "Put back in stock");
      handleRefundSaved(order._id, result.order);
    } catch (error) {
      handleApiError(error, "Failed to put back in stock");
    } finally {
      setRestockingId(null);
    }
  };
  const canRefund = (order) =>
    ["paid", "on_hold", "shipped", "delivered"].includes(order?.status) &&
    getRefundLimit(order, getRefundedTotal(order)) > 0;

  // Shipment view: which orders are expanded to their full details.
  const [openParcelOrders, setOpenParcelOrders] = React.useState({});
  const toggleParcelOrder = (id) =>
    setOpenParcelOrders((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── Backorder shipments in the order list ──
  // Each later shipment (Shipment 2, 3, …) of an order is its own line under
  // the order. Open by default; the arrow on the order's invoice hides them.
  const [closedBackorders, setClosedBackorders] = React.useState({});
  const toggleBackorders = (id) =>
    setClosedBackorders((prev) => ({ ...prev, [id]: !prev[id] }));
  const laterShipments = (order) =>
    !order || order.status === "cancelled"
      ? []
      : getBackorderShipments(withBackorderUpdate(order));
  // Held items can be changed until the order ships; once it has shipped,
  // what is still waiting can be shipped.
  const canChangeBackorder = (order) =>
    order?.status === "paid" || order?.status === "on_hold";
  const canShipBackorder = (order) =>
    (order?.status === "shipped" || order?.status === "delivered") &&
    hasAwaitingBackorder(withBackorderUpdate(order));
  const backorderMenuItems = (order) => {
    const current = withBackorderUpdate(order);
    return [
      canChangeBackorder(current) && {
        label: hasAwaitingBackorder(current)
          ? "Change Backorder"
          : "Backorder Items",
        onSelect: () => setBackorderOrder(current),
      },
      canShipBackorder(current) && {
        label: "Ship Backordered Items",
        onSelect: () => setShipBackorderOrder(current),
      },
    ];
  };

  // The backorder shipment being viewed: { orderId, generation }. The order is
  // looked up fresh each render so saved changes show straight away.
  const [viewBackorder, setViewBackorder] = React.useState(null);

  // What a shipment's items cost, from the prices paid (blank if unknown).
  const shipmentValue = (order, shipment) => {
    const prices = Object.fromEntries(
      getOrderLines(order).map((l) => [l.key, l.unitPrice]),
    );
    let total = 0;
    for (const line of shipment.lines) {
      if (prices[line.lineKey] == null) return null;
      total += prices[line.lineKey] * line.quantity;
    }
    return Math.round(total * 100) / 100;
  };

  // One later shipment's line in the order list.
  const renderBackorderShipmentCells = (order, shipment) => {
    const current = withBackorderUpdate(order);
    const isWaiting = shipment.status === "awaiting";
    const invoice = getInvoiceNumber(order) || order._id?.substring(0, 7);
    const items = shipment.lines.reduce((n, l) => n + l.quantity, 0);
    const value = shipmentValue(current, shipment);
    const createdAt = shipment.lines
      .map((l) => l.createdAt)
      .filter(Boolean)
      .sort()[0];
    const shippable = isWaiting && canShipBackorder(current);

    return (
      <>
        {/* Invoice · Shipment N */}
        <TableCell truncate={false} className="font-mono text-xs">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">↳</span>
            {isWaiting ? (
              <Clock className="size-3.5 shrink-0 text-amber-600" />
            ) : (
              <Truck className="size-3.5 shrink-0 text-blue-600" />
            )}
            <span className="flex flex-col items-start leading-tight">
              <span className="font-sans font-semibold">
                Shipment {shipment.generation}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {invoice}
              </span>
            </span>
          </span>
        </TableCell>

        {/* Customer */}
        <TableCell maxWidth="180px">{formatFullName(order.userId)}</TableCell>

        {/* Email */}
        <TableCell>{display(order.email)}</TableCell>

        {/* Type */}
        <TableCell truncate={false}>
          <div className="flex flex-col items-center leading-tight">
            <span className="font-semibold">Backorder</span>
            <span className="text-[10px] text-muted-foreground">
              {items} item{items === 1 ? "" : "s"}
            </span>
          </div>
        </TableCell>

        {/* Payment — paid with the order */}
        <TableCell className="text-xs text-muted-foreground">
          With order
        </TableCell>

        {/* Value of the items in this shipment */}
        {value == null ? (
          <TableCell className="text-muted-foreground">—</TableCell>
        ) : (
          <TableCell className="text-muted-foreground font-semibold">
            {formatCurrency(value)}
          </TableCell>
        )}

        {/* Status */}
        <TableCell truncate={false}>
          <div className="flex flex-col items-center gap-1">
            <Badge
              className={`font-medium ${isWaiting ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"}`}
            >
              {isWaiting ? "Awaiting shipment" : "Shipped"}
            </Badge>
            {!isWaiting && shipment.shipping?.trackingNumber && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {shipment.shipping.carrier} · {shipment.shipping.trackingNumber}
              </span>
            )}
            {isWaiting && !canShipBackorder(current) && (
              <span className="text-[10px] text-muted-foreground">
                Ships after the rest of the order
              </span>
            )}
          </div>
        </TableCell>

        {/* Created At — when the items were held back */}
        <TimestampCells createdAt={createdAt || order.createdAt} withTime />

        {/* Actions */}
        <ActionsColumn
          onView={() =>
            setViewBackorder({
              orderId: order._id,
              order,
              generation: shipment.generation,
            })
          }
          viewTitle="View shipment"
          onEdit={shippable ? () => setShipBackorderOrder(current) : undefined}
          editTitle="Mark as shipped"
          extraActions={[
            canChangeBackorder(current) && {
              label: "Backorder Items",
              onSelect: () => setBackorderOrder(current),
            },
            { label: "View order", onSelect: () => handleView(order) },
          ]}
        />
      </>
    );
  };

  // The lines under an order for its later shipments (none when hidden).
  const renderBackorderRows = (order) =>
    !closedBackorders[order._id] &&
    laterShipments(order).map((shipment) => (
      <tr
        key={`${order._id}-bo-${shipment.generation}`}
        className={`border-t border-dashed text-sm ${shipment.status === "awaiting" ? "bg-amber-50/60 dark:bg-amber-950/20" : "bg-muted/40"}`}
      >
        {renderBackorderShipmentCells(order, shipment)}
      </tr>
    ));

  // The Customer and Shipping Address boxes of an order view (same look as
  // before). Also used in the backorder shipment view.
  const renderCustomerSection = (viewOrder) => (
    <>
      {/* ── Customer ── */}
      <section className="space-y-2">
        <Label className="font-semibold text-xs uppercase">Customer</Label>
        <div className="rounded-lg border divide-y text-sm">
          <div className="grid grid-cols-[140px_1fr] p-3">
            <span className="font-semibold text-xs">Name</span>
            <span className="text-xs">
              {formatFullName(viewOrder?.userId)}
            </span>
          </div>
          <div className="grid grid-cols-[140px_1fr] p-3">
            <span className="font-semibold text-xs">Email</span>
            <span className="text-xs break-all">
              {viewOrder?.email || "—"}
            </span>
          </div>
          {viewOrder?.shipping?.address?.phone && (
            <div className="grid grid-cols-[140px_1fr] p-3">
              <span className="font-semibold text-xs">Contact No.</span>
              <span className="text-xs">
                {formatPhone(viewOrder.shipping.address.phone)}
              </span>
            </div>
          )}
        </div>
      </section>
    </>
  );
  const renderShippingAddressSection = (viewOrder) => (
    <>
      {/* ── Shipping Address ── */}
      {viewOrder?.shipping?.address && (
        <section className="space-y-2">
          <Label className="font-semibold text-xs uppercase">
            Shipping Address
          </Label>
          <div className="rounded-lg border divide-y text-sm">
            <div className="grid grid-cols-[140px_1fr] p-3">
              <span className="font-semibold text-xs">Recipient</span>
              <span className="text-xs">
                {viewOrder?.shipping?.address?.name || "—"}
              </span>
            </div>
            <div className="grid grid-cols-[140px_1fr] p-3">
              <span className="font-semibold text-xs">Address</span>
              {(() => {
                const fullAddress = [
                  viewOrder?.shipping?.address?.line1,
                  viewOrder?.shipping?.address?.line2,
                  viewOrder?.shipping?.address?.city,
                  viewOrder?.shipping?.address?.state,
                  viewOrder?.shipping?.address?.postalCode,
                  viewOrder?.shipping?.address?.country,
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <span className="flex items-start justify-between gap-2 text-xs">
                    <span className="select-all">{fullAddress || "—"}</span>
                    {fullAddress && (
                      <CopyButton
                        value={shipToText(viewOrder?.shipping?.address)}
                        label="name and shipping address"
                      />
                    )}
                  </span>
                );
              })()}
            </div>
            {viewOrder?.shipping?.address?.phone && (
              <div className="grid grid-cols-[140px_1fr] p-3">
                <span className="font-semibold text-xs">Contact No.</span>
                <span className="text-xs">
                  {formatPhone(viewOrder.shipping.address.phone)}
                </span>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );

  // One order's cells. `nested` marks an order listed under its shipment row,
  // where the "Consolidated" tag would only repeat the row above. Inside a
  // paid shipment an order can only be cancelled — shipping happens once, on
  // the shipment row, and it can't be handed over on its own.
  const renderOrderCells = (order, { nested = false, parcel = null } = {}) => {
    const invoice = getInvoiceNumber(order) || order._id?.substring(0, 7);
    const allowed = parcel?.status === "paid" ? ["cancelled"] : undefined;
    const transitions = getAvailableTransitions(order.status, allowed);
    const statusConfig = getOrderStatusConfig(order);
    const shipment = nested ? null : getOrderShipment(order);
    const later = laterShipments(order);
    const laterOpen = later.length > 0 && !closedBackorders[order._id];

    return (
      <>
        {/* Invoice — with an arrow that shows/hides its later shipments */}
        {later.length > 0 ? (
          <TableCell truncate={false} className="font-mono text-xs">
            <button
              type="button"
              onClick={() => toggleBackorders(order._id)}
              aria-expanded={laterOpen}
              title={laterOpen ? "Hide later shipments" : "Show later shipments"}
              className="inline-flex items-center gap-1 cursor-pointer hover:text-primary"
            >
              {nested && <span className="text-muted-foreground">↳</span>}
              <ChevronRight
                className={`size-4 transition-transform ${laterOpen ? "rotate-90" : ""}`}
              />
              {invoice}
            </button>
          </TableCell>
        ) : (
          <TableCell maxWidth="160px" className="font-mono text-xs">
            {nested && <span className="text-muted-foreground mr-1">↳</span>}
            {invoice}
          </TableCell>
        )}

        {/* Customer */}
        <TableCell maxWidth="180px">{formatFullName(order.userId)}</TableCell>

        {/* Email */}
        <TableCell>{display(order.email)}</TableCell>

        {/* Order Type */}
        <TableCell className="capitalize">{display(order.orderType)}</TableCell>

        {/* Payment Method */}
        <TableCell>{getPaymentGatewayLabel(order)}</TableCell>

        {/* Total */}
        <PriceCell amount={order.payment?.totalAmount} />

        {/* Status */}
        <TableCell>
          <div className="flex flex-col items-center gap-1">
            <Badge className={`font-medium ${statusConfig.iconColor}`}>
              {statusConfig.label}
            </Badge>
            {shipment && (
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide ${shipment.reviewNote ? "text-destructive" : "text-blue-600"}`}
              >
                Consolidated · {shipment.orders?.length || 0} orders
              </span>
            )}
            {hasAwaitingBackorder(withBackorderUpdate(order)) && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                Backorder ·{" "}
                {getAwaitingBackorders(withBackorderUpdate(order)).length} item
                {getAwaitingBackorders(withBackorderUpdate(order)).length === 1
                  ? ""
                  : "s"}{" "}
                waiting
              </span>
            )}
            {order.status !== "cancelled" &&
              getRefundedTotal(withBackorderUpdate(order)) > 0 && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
                  Refunded{" "}
                  {formatCurrency(getRefundedTotal(withBackorderUpdate(order)))}
                </span>
              )}
          </div>
        </TableCell>

        {/* Created At */}
        <TimestampCells createdAt={order.createdAt} withTime />

        {/* Actions */}
        <ActionsColumn
          onView={() => handleView(order)}
          onEdit={
            transitions.length > 0
              ? () => handleEdit(order, { allowed })
              : undefined
          }
          editTitle={allowed ? "Cancel order" : undefined}
          extraActions={
            order.status === "cancelled" ? [] : backorderMenuItems(order)
          }
          onExport={() => exportOrderToPdf(order)}
        />
      </>
    );
  };

  // A consolidated shipment: one row for the parcel and its shipping invoice.
  // Expanding it lists every order inside (see renderExpanded below).
  const renderShipmentCells = (group) => {
    const { shipment, orders } = group;
    const isOpen = Boolean(expandedShipments[shipment._id]);
    const statusConfig = getShipmentStatusConfig(shipment);
    const firstOrder = orders[0];
    // Marking any paid order in the parcel as shipped ships them all.
    const paidOrder = orders.find((o) => o.status === "paid");
    const canShip = shipment.status === "paid" && paidOrder;

    return (
      <>
        {/* Shipping invoice — toggles the order list */}
        <TableCell truncate={false}>
          <button
            type="button"
            onClick={() => toggleShipment(shipment._id)}
            aria-expanded={isOpen}
            title={isOpen ? "Hide orders" : "Show orders"}
            className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold cursor-pointer hover:text-primary"
          >
            <ChevronRight
              className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
            <Boxes className="size-4 text-blue-600" />
            {getShipmentRef(shipment)}
          </button>
        </TableCell>

        {/* Customer */}
        <TableCell maxWidth="180px">
          {formatFullName(firstOrder?.userId)}
        </TableCell>

        {/* Email */}
        <TableCell>{display(shipment.email || firstOrder?.email)}</TableCell>

        {/* Type */}
        <TableCell truncate={false}>
          <div className="flex flex-col items-center leading-tight">
            <span className="font-semibold">Shipment</span>
            <span className="text-[10px] text-muted-foreground">
              {orders.length} order{orders.length === 1 ? "" : "s"}
            </span>
          </div>
        </TableCell>

        {/* Payment Method — how shipping was paid */}
        <TableCell>{getPaymentGatewayLabel(shipment)}</TableCell>

        {/* Shipping paid */}
        <PriceCell amount={shipment.payment?.totalAmount} />

        {/* Status */}
        <TableCell>
          <div className="flex flex-col items-center gap-1">
            <Badge className={`font-medium ${statusConfig.iconColor}`}>
              {statusConfig.label}
            </Badge>
            {shipment.reviewNote && (
              <span
                className="text-[10px] font-semibold uppercase tracking-wide text-destructive"
                title={shipment.reviewNote}
              >
                Check address
              </span>
            )}
          </div>
        </TableCell>

        {/* Created At — when shipping was paid */}
        <TimestampCells createdAt={shipment.createdAt} withTime />

        {/* Actions */}
        <ActionsColumn
          onView={() => handleViewShipment(group)}
          viewTitle="View shipment"
          onExport={() => exportShipmentToPdf(shipment, orders)}
          exportTitle="Export shipment"
          onEdit={
            canShip
              ? () =>
                  handleEdit(paidOrder, {
                    presetStatus: "shipped",
                    allowed: ["shipped"],
                  })
              : undefined
          }
          editTitle="Mark as shipped"
        />
      </>
    );
  };

  // Every section of one order's details — the order view, and each order
  // inside the shipment view. `inShipment` drops what the shipment already
  // shows once (customer, address, tracking, status, shipping fee) so each
  // order reads as just its own details.
  const renderOrderDetails = (viewOrder, { inShipment = false } = {}) => (
    <>
      {/* ── The top of the order: Order Information on the left; Customer,
          Billing and Shipping Address beside it. It stays in place while the
          rest scrolls (order view only). ── */}
      <div
        className={
          inShipment
            ? "space-y-5"
            : "grid gap-5 md:grid-cols-2 items-start [@media(min-height:700px)]:sticky top-0 z-10 -mx-5 px-5 pb-4 bg-background [@media(min-height:700px)]:border-b"
        }
      >
        <div className="min-w-0">
        {/* ── Order Information ── */}
        <section className="space-y-2">
          <Label className="font-semibold text-xs uppercase">
            Order Information
          </Label>
          <div className="rounded-lg border divide-y text-sm">
            <div className="grid grid-cols-[140px_1fr] p-3">
              <span className="font-semibold text-xs">Invoice Number</span>
              {getInvoiceUrl(viewOrder) && getInvoiceNumber(viewOrder) ? (
                <a
                  href={getInvoiceUrl(viewOrder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline underline-offset-2"
                >
                  {getInvoiceNumber(viewOrder)}
                </a>
              ) : (
                <span className="text-xs">
                  {getInvoiceNumber(viewOrder) ||
                    viewOrder?._id?.substring(0, 7) ||
                    "—"}
                </span>
              )}
            </div>
            {!inShipment && (
              <div className="grid grid-cols-[140px_1fr] p-3">
                <span className="font-semibold text-xs">Status</span>
                <div className="flex items-center">
                  <span
                    className={`text-xs font-semibold ${
                      getOrderStatusConfig(viewOrder).variant === "success"
                        ? "text-success"
                        : getOrderStatusConfig(viewOrder).variant === "info"
                          ? "text-blue-600"
                          : getOrderStatusConfig(viewOrder).variant ===
                              "destructive"
                            ? "text-destructive"
                            : getOrderStatusConfig(viewOrder).variant ===
                                "secondary"
                              ? "text-amber-600"
                              : "text-muted-foreground"
                    }`}
                  >
                    {getOrderStatusConfig(viewOrder).label}
                  </span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-[140px_1fr] p-3">
              <span className="font-semibold text-xs">Order Type</span>
              <span className="text-xs capitalize">
                {viewOrder?.orderType || "—"}
              </span>
            </div>
            <div className="grid grid-cols-[140px_1fr] p-3">
              <span className="font-semibold text-xs">Paid At</span>
              <span className="text-xs">
                {formatDate(viewOrder?.payment?.paidAt)}
              </span>
            </div>
            <div className="grid grid-cols-[140px_1fr] p-3">
              <span className="font-semibold text-xs">Paid With</span>
              <span className="text-xs">{getPaymentGatewayLabel(viewOrder)}</span>
            </div>
            {!inShipment && viewOrder?.payment?.shippingCountryMismatch && (
              <div className="grid grid-cols-[140px_1fr] p-3 bg-destructive/5">
                <span className="font-semibold text-xs text-destructive">
                  Shipping Check
                </span>
                <span className="text-xs font-semibold text-destructive">
                  Shipping was paid for{" "}
                  {viewOrder.payment.shippingCountryMismatch.expected}, but the
                  address is in {viewOrder.payment.shippingCountryMismatch.actual}
                  . Review before shipping.
                </span>
              </div>
            )}
          </div>
        </section>
        </div>

        <div className="min-w-0 space-y-5">
        {!inShipment && renderCustomerSection(viewOrder)}

        {/* ── Billing Details ── */}
        {(viewOrder?.billing?.cardHolderName || viewOrder?.billing?.country) && (
          <section className="space-y-2">
            <Label className="font-semibold text-xs uppercase">
              Billing Details
            </Label>
            <div className="rounded-lg border divide-y text-sm">
              <div className="grid grid-cols-[140px_1fr] p-3">
                <span className="font-semibold text-xs">Cardholder Name</span>
                <span className="text-xs">
                  {viewOrder.billing.cardHolderName || "—"}
                </span>
              </div>
              <div className="grid grid-cols-[140px_1fr] p-3">
                <span className="font-semibold text-xs">Country</span>
                <span className="text-xs">
                  {viewOrder.billing.country || "—"}
                </span>
              </div>
            </div>
          </section>
        )}

        {!inShipment && renderShippingAddressSection(viewOrder)}
        </div>
      </div>

      {!inShipment && (
        <>
          {/* ── Shipping & Tracking ── */}
          {viewOrder?.shipping?.carrier && (
            <section className="space-y-2">
              <Label className="font-semibold text-xs uppercase">
                Tracking Information
              </Label>
              <div className="rounded-lg border divide-y text-sm">
                <div className="grid grid-cols-[140px_1fr] p-3">
                  <span className="font-semibold text-xs">Carrier</span>
                  <span className="text-xs">
                    {viewOrder.shipping.carrier || "—"}
                  </span>
                </div>
                <div className="grid grid-cols-[140px_1fr] p-3">
                  <span className="font-semibold text-xs text-nowrap">
                    Tracking No.
                  </span>
                  <span className="text-xs">
                    {viewOrder.shipping.trackingNumber || "—"}
                  </span>
                </div>
                <div className="grid grid-cols-[140px_1fr] p-3">
                  <span className="font-semibold text-xs truncate">
                    Tracking Link
                  </span>
                  <a
                    href={viewOrder.shipping.trackingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline underline-offset-2 break-all"
                  >
                    {viewOrder.shipping.trackingLink || "—"}
                  </a>
                </div>
              </div>
            </section>
          )}

          {/* ── Delivery Details ── */}
          {viewOrder?.status === "delivered" && (
            <section className="space-y-2">
              <Label className="font-semibold text-xs uppercase">
                Delivery Details
              </Label>
              <div className="rounded-lg border divide-y text-sm">
                <div className="grid grid-cols-[140px_1fr] p-3">
                  <span className="font-semibold text-xs">Method</span>
                  <span className="text-xs">
                    {getDeliveryMethodLabel(viewOrder.delivery?.method)}
                  </span>
                </div>
                <div className="grid grid-cols-[140px_1fr] p-3">
                  <span className="font-semibold text-xs">Delivered On</span>
                  <span className="text-xs">
                    {formatDate(
                      viewOrder.delivery?.deliveredAt || viewOrder.updatedAt,
                    )}
                  </span>
                </div>
                {viewOrder.delivery?.receivedBy && (
                  <div className="grid grid-cols-[140px_1fr] p-3">
                    <span className="font-semibold text-xs">Received By</span>
                    <span className="text-xs">
                      {viewOrder.delivery.receivedBy}
                    </span>
                  </div>
                )}
                {viewOrder.delivery?.deliveredById && (
                  <div className="grid grid-cols-[140px_1fr] p-3">
                    <span className="font-semibold text-xs">Handled By</span>
                    <span className="text-xs">
                      {formatFullName(viewOrder.delivery.deliveredById)}
                    </span>
                  </div>
                )}
                {viewOrder.delivery?.notes && (
                  <div className="grid grid-cols-[140px_1fr] p-3">
                    <span className="font-semibold text-xs">Notes</span>
                    <span className="text-xs">{viewOrder.delivery.notes}</span>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Order Items ── */}
      <section className="space-y-2">
        <Label className="font-semibold text-xs uppercase">
          {viewOrder?.orderType === "dealer" ||
          viewOrder?.orderType === "wholesale"
            ? "Order Details"
            : "Items"}
        </Label>

        {/* Standard Product View — same row layout as the dealer manifest */}
        {(viewOrder?.orderType === "product" || viewOrder?.productItems) && (
          <div className="rounded-lg border p-3 space-y-2">
            {(viewOrder.productItems || viewOrder.items || []).map(
              (item, index) => {
                const { name, colorName } = splitProductItemName(item);
                return (
                  <OrderItemRow
                    key={index}
                    imageUrl={item.imageUrl}
                    name={name}
                    quantity={item.quantity}
                    meta={[colorName]}
                    unitPrice={item.unitPrice}
                    originalUnitPrice={item.basePrice}
                    originalTotalPrice={item.basePrice * item.quantity}
                    totalPrice={item.totalPrice}
                  />
                );
              },
            )}
          </div>
        )}

        {/* Dealer Manifest View */}
        {(viewOrder?.orderType === "dealer" ||
          viewOrder?.orderType === "wholesale") &&
          viewOrder.dealerItems && (
            <div className="space-y-4">
              {/* Bundles + Torso Bags */}
              {(() => {
                const di = viewOrder.dealerItems;
                const bundleList = di.bundles?.length
                  ? di.bundles
                  : di.bundle?.name
                    ? [{ ...di.bundle, torsoBags: di.torsoBags ?? [] }]
                    : [];
                if (bundleList.length === 0) return null;
                return (
                  <div className="rounded-lg border">
                    <div className="p-3 border-b font-semibold text-xs bg-success/20 rounded-t-md">
                      Selected Bundle{bundleList.length !== 1 ? "s" : ""}
                    </div>
                    <div className="divide-y">
                      {bundleList.map((bundle, bi) => (
                        <div key={bi}>
                          <div className="p-3 flex justify-between items-center">
                            <span className="text-xs font-medium">
                              {bundle.name}
                            </span>
                            <span className="text-xs font-bold text-success dark:text-accent">
                              {formatCurrency(bundle.price)}
                            </span>
                          </div>

                          {/* Torso bags */}
                          {bundle.torsoBags?.length > 0 && (
                            <div className="border-t px-3 py-2 space-y-3">
                              {bundle.torsoBags.map((tb, i) => (
                                <div
                                  key={i}
                                  className="flex justify-between items-center"
                                >
                                  <span className="text-xs">{tb.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ×{tb.quantity}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Addons */}
              {viewOrder.dealerItems.addons?.length > 0 && (
                <div className="rounded-lg border">
                  <div className="p-3 border-b font-semibold text-xs bg-success/20 rounded-t-md">
                    Add-on Selections
                  </div>
                  <div className="divide-y">
                    {viewOrder.dealerItems.addons.map((addon, idx) => (
                      <div key={idx} className="p-3 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold">
                            {addon.name}
                            {addon.quantity > 1 ? ` × ${addon.quantity}` : ""}
                          </span>
                          <span className="font-bold text-success dark:text-accent">
                            {addon.totalPrice > 0
                              ? formatCurrency(addon.totalPrice)
                              : "Free"}
                          </span>
                        </div>
                        {addon.subItems?.length > 0 && (
                          <div className="space-y-2 mt-1">
                            {addon.subItems.map((sub, sIdx) => (
                              <OrderItemRow
                                key={sIdx}
                                imageUrl={sub.imageUrl}
                                name={sub.name}
                                nameSuffix={
                                  sub.piecesPerBag != null && (
                                    <span className="font-normal">
                                      {" - "}
                                      <span className="font-bold text-red-600 dark:text-red-500">
                                        {sub.piecesPerBag}
                                      </span>{" "}
                                      {perBagUnit(
                                        sub.category,
                                        sub.piecesPerBag,
                                      )}
                                    </span>
                                  )
                                }
                                quantity={sub.qty}
                                quantityUnit="bag"
                                meta={[sub.bin, sub.colorName]}
                                unitPrice={sub.pricePerBag}
                                originalUnitPrice={sub.originalPricePerBag}
                                // Flash-sale provenance: what this quantity
                                // would have billed at pre-sale, struck
                                // through beside what was charged. Only set
                                // when genuinely discounted.
                                originalTotalPrice={
                                  sub.originalPricePerBag != null
                                    ? sub.originalPricePerBag * sub.qty
                                    : undefined
                                }
                                totalPrice={sub.totalPrice}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extra Bags */}
              {viewOrder.dealerItems.extraBags?.length > 0 && (
                <div className="rounded-lg border">
                  <div className="divide-y">
                    {viewOrder.dealerItems.extraBags.map((bag, idx) => (
                      <div
                        key={idx}
                        className="p-3 flex justify-between items-center gap-2"
                      >
                        <span className="text-xs font-semibold">
                          {bag.name}{" "}
                          <span className="text-muted-foreground font-normal">
                            ({bag.quantity} bag{bag.quantity !== 1 ? "s" : ""})
                          </span>
                        </span>
                        <span className="text-xs font-semibold shrink-0 text-success">
                          {formatCurrency(
                            bag.totalPrice ?? bag.quantity * bag.price,
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
      </section>

      {/* ── Backorder: items shipping separately ── */}
      <BackorderShipments
        order={viewOrder}
        admin
        actions={
          (viewOrder?.status === "shipped" ||
            viewOrder?.status === "delivered") &&
          hasAwaitingBackorder(viewOrder) && (
            <Button size="sm" onClick={() => setShipBackorderOrder(viewOrder)}>
              Ship Backordered Items
            </Button>
          )
        }
      />
      {(viewOrder?.status === "paid" || viewOrder?.status === "on_hold") && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBackorderOrder(viewOrder)}
          >
            {hasAwaitingBackorder(viewOrder)
              ? "Change Backorder"
              : "Backorder Items (out of stock)"}
          </Button>
        </div>
      )}

      {/* ── Refunds made without cancelling ── */}
      <OrderRefunds
        order={viewOrder}
        admin
        onRestock={(refund) => handleRestock(viewOrder, refund)}
        restockingId={restockingId}
        actions={
          canRefund(viewOrder) && (
            <Button size="sm" variant="outline" onClick={() => setRefundOrder(viewOrder)}>
              Refund
            </Button>
          )
        }
      />
      {canRefund(viewOrder) && !viewOrder?.refunds?.length && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setRefundOrder(viewOrder)}>
            Refund Items or an Amount
          </Button>
        </div>
      )}

      {/* ── Refund Details ── */}
      {viewOrder?.status === "cancelled" && (
        <section className="space-y-2">
          <Label className="font-semibold text-xs uppercase text-destructive">
            Refund Details
          </Label>
          <div className="rounded-lg border divide-y text-sm">
            {getRefundId(viewOrder) && (
              <div className="flex justify-between items-start p-3 gap-4">
                <span className="font-semibold text-xs shrink-0">
                  Refund ID
                </span>
                <span className="text-xs text-right font-mono">
                  {getRefundId(viewOrder)}
                </span>
              </div>
            )}
            {viewOrder.refund?.status === "completed" &&
              viewOrder.refund?.arn && (
                <div className="flex justify-between items-start p-3 gap-4">
                  <span className="font-semibold text-xs shrink-0">ARN</span>
                  <span className="text-xs text-right font-mono">
                    {viewOrder.refund.arn}
                  </span>
                </div>
              )}
            <div className="flex justify-between items-start p-3">
              <span className="font-semibold text-xs">Cancelled On</span>
              <span className="text-xs text-right">
                {formatDate(
                  viewOrder?.cancellation?.cancelledAt || viewOrder.updatedAt,
                )}
              </span>
            </div>
            <div className="flex justify-between items-start p-3">
              <span className="font-semibold text-xs">Cancelled By</span>
              <span className="text-xs text-right">
                {viewOrder.cancellation?.cancelledById
                  ? formatFullName(viewOrder.cancellation.cancelledById)
                  : viewOrder.cancellation?.cancelledByRole || "—"}
              </span>
            </div>
            <div className="flex justify-between items-start p-3">
              <span className="font-semibold text-xs">Reason</span>
              <span className="text-xs text-right">
                {viewOrder.cancellation?.reason || "—"}
              </span>
            </div>
            {viewOrder.cancellation?.notes && (
              <div className="flex justify-between items-start p-3 gap-4">
                <span className="font-semibold text-xs shrink-0">Notes</span>
                <span className="text-xs text-right">
                  {viewOrder.cancellation.notes}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Payment Summary ── */}
      <section className="space-y-2">
        <Label className="font-semibold text-xs uppercase">
          Payment Summary
        </Label>
        <div className="rounded-lg border divide-y text-sm">
          <div className="flex justify-between items-center p-3">
            <span className="font-semibold text-xs">Subtotal</span>
            <span className="text-xs">
              {formatCurrency(viewOrder?.payment?.subtotal)}
            </span>
          </div>
          {!(inShipment && !viewOrder?.payment?.shippingFee) && (
            <div className="flex justify-between items-center p-3">
              <span className="font-semibold text-xs">Shipping Fee</span>
              <span className="text-xs">
                {/* Shipped in a consolidated parcel — its fee was paid once, on
                  the shipment. */}
                {getOrderShipment(viewOrder) && !viewOrder?.payment?.shippingFee
                  ? `In Shipment #${getShipmentRef(getOrderShipment(viewOrder))}`
                  : formatCurrency(viewOrder?.payment?.shippingFee)}
              </span>
            </div>
          )}
          {viewOrder?.payment?.shippingInsurance > 0 && (
            <div className="flex justify-between items-center p-3">
              <span className="font-semibold text-xs">
                Shipping Insurance (0.5%)
              </span>
              <span className="text-xs">
                {formatCurrency(viewOrder.payment.shippingInsurance)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center p-3">
            <span className="font-semibold text-xs">Sales Tax</span>
            <span className="text-xs">
              {formatCurrency(viewOrder?.payment?.taxAmount ?? 0)}
            </span>
          </div>
          {viewOrder?.payment?.discount?.amount > 0 && (
            <div className="flex justify-between items-start p-3 gap-3">
              <div className="flex flex-col space-y-1">
                <span className="font-semibold text-xs">
                  {viewOrder.payment.discount.couponName || "Discount"}
                  {viewOrder.payment.discount.percentOff
                    ? ` (${viewOrder.payment.discount.percentOff}% off)`
                    : viewOrder.payment.discount.amountOff
                      ? ` (${formatCurrency(viewOrder.payment.discount.amountOff)} off)`
                      : ""}
                </span>
                {viewOrder.payment.discount.promotionCode && (
                  <span className="text-[10px] text-muted-foreground font-normal">
                    Code: {viewOrder.payment.discount.promotionCode}
                  </span>
                )}
              </div>
              <span className="text-xs">
                -{formatCurrency(viewOrder.payment.discount.amount)}
              </span>
            </div>
          )}
          {getRefundedTotal(viewOrder) > 0 && (
            <div className="flex justify-between items-center p-3 text-destructive">
              <span className="font-semibold text-xs">
                Refunded {viewOrder?.status === "cancelled" ? "before cancelling" : "so far"}
              </span>
              <span className="text-xs">
                -{formatCurrency(getRefundedTotal(viewOrder))}
              </span>
            </div>
          )}
          <div
            className={`flex justify-between items-center p-3 font-bold ${viewOrder?.status === "cancelled" ? "text-destructive" : "text-success"}`}
          >
            <span>
              {viewOrder?.status === "cancelled" ? "Refund Amount" : "Total"}
            </span>
            <span>
              {formatCurrency(
                viewOrder?.status === "cancelled"
                  ? viewOrder?.refund?.amount || viewOrder?.payment?.totalAmount
                  : viewOrder?.payment?.totalAmount,
              )}
            </span>
          </div>
        </div>
      </section>
    </>
  );

  // Label / value row in the details sections.
  const detailRow = (label, value) => (
    // Wide enough for "Shipping Insurance (0.5%)" on one line, so every row's
    // value lines up.
    <div className="grid grid-cols-[170px_1fr] gap-x-3 p-3">
      <span className="font-semibold text-xs whitespace-nowrap">{label}</span>
      <span className="text-xs">{value}</span>
    </div>
  );

  // The consolidated shipment view: the parcel's shipping details, then the
  // full details of every order inside it.
  const renderShipmentDetails = ({ shipment, orders }) => {
    const payment = shipment.payment || {};
    const shipping = shipment.shipping || {};
    const address = shipping.address || {};
    const statusConfig = getShipmentStatusConfig(shipment);
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

    return (
      <>
        {/* ── Shipment Information ── */}
        <section className="space-y-2">
          <Label className="font-semibold text-xs uppercase">
            Shipment Information
          </Label>
          <div className="rounded-lg border divide-y text-sm">
            {shipment.reviewNote && (
              <div className="p-3 bg-destructive/5 text-xs font-semibold text-destructive">
                {shipment.reviewNote}
              </div>
            )}
            {detailRow(
              "Shipping Invoice",
              payment.receiptUrl ? (
                <a
                  href={payment.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  {getShipmentRef(shipment)}
                </a>
              ) : (
                getShipmentRef(shipment)
              ),
            )}
            {detailRow(
              "Status",
              <Badge className={`font-medium ${statusConfig.iconColor}`}>
                {statusConfig.label}
              </Badge>,
            )}
            {detailRow("Orders", orders.length)}
            {detailRow(
              "Paid At",
              payment.paidAt ? formatDate(payment.paidAt) : "—",
            )}
            {detailRow("Paid With", getPaymentGatewayLabel(shipment))}
          </div>
        </section>

        {/* ── Customer — once for the parcel; every order is theirs ── */}
        <section className="space-y-2">
          <Label className="font-semibold text-xs uppercase">Customer</Label>
          <div className="rounded-lg border divide-y text-sm">
            {detailRow("Name", formatFullName(orders[0]?.userId))}
            {detailRow("Email", display(shipment.email || orders[0]?.email))}
            {address.phone &&
              detailRow("Contact No.", formatPhone(address.phone))}
          </div>
        </section>

        {/* ── Ship To ── */}
        {address.line1 && (
          <section className="space-y-2">
            <Label className="font-semibold text-xs uppercase">Ship To</Label>
            <div className="rounded-lg border divide-y text-sm">
              {detailRow("Recipient", address.name || "—")}
              {detailRow(
                "Address",
                <span className="flex items-start justify-between gap-2">
                  <span className="select-all">{fullAddress}</span>
                  <CopyButton
                    value={shipToText(address)}
                    label="name and shipping address"
                  />
                </span>,
              )}
              {address.phone &&
                detailRow("Contact No.", formatPhone(address.phone))}
            </div>
          </section>
        )}

        {/* ── Shipping & Tracking — once shipped ── */}
        {shipping.trackingNumber && (
          <section className="space-y-2">
            <Label className="font-semibold text-xs uppercase">
              Shipping & Tracking
            </Label>
            <div className="rounded-lg border divide-y text-sm">
              {detailRow("Carrier", shipping.carrier || "—")}
              {detailRow("Tracking No.", shipping.trackingNumber)}
              {shipping.trackingLink &&
                detailRow(
                  "Tracking Link",
                  <a
                    href={shipping.trackingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {shipping.trackingLink}
                  </a>,
                )}
              {detailRow(
                "Shipped At",
                shipping.shippedAt ? formatDate(shipping.shippedAt) : "—",
              )}
            </div>
          </section>
        )}

        {/* ── Orders in the parcel — click an invoice to open its details ── */}
        <section className="space-y-2">
          <Label className="font-semibold text-xs uppercase">
            Orders in this Shipment ({orders.length})
          </Label>
          {orders.map((order) => {
            const isOpen = Boolean(openParcelOrders[order._id]);
            return (
              <div
                key={order._id}
                className={`rounded-lg border ${isOpen ? "border-blue-300 dark:border-blue-700" : ""}`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => toggleParcelOrder(order._id)}
                  aria-expanded={isOpen}
                  className="h-auto w-full justify-between gap-3 p-3 text-xs hover:bg-muted/20 dark:hover:bg-muted/20"
                >
                  <span className="flex items-center gap-2 font-bold text-blue-600 dark:text-blue-400">
                    <ChevronRight
                      className={`size-4 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                    Invoice #
                    {getInvoiceNumber(order) || order._id?.substring(0, 7)}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-success dark:text-accent">
                    {formatCurrency(order.payment?.totalAmount)}
                  </span>
                </Button>
                {isOpen && (
                  <div className="space-y-5 px-4 pb-4">
                    {renderOrderDetails(withBackorderUpdate(order), {
                      inShipment: true,
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* ── Payment Summary — what the shipment itself charged ── */}
        <section className="space-y-2">
          <Label className="font-semibold text-xs uppercase">
            Payment Summary
          </Label>
          <div className="rounded-lg border divide-y text-sm">
            <div className="flex justify-between items-center p-3">
              <span className="font-semibold text-xs">Shipping Fee</span>
              <span className="text-xs">
                {formatCurrency(payment.shippingFee)}
              </span>
            </div>
            {payment.shippingInsurance > 0 && (
              <div className="flex justify-between items-center p-3">
                <span className="font-semibold text-xs">
                  Shipping Insurance (0.5%)
                </span>
                <span className="text-xs">
                  {formatCurrency(payment.shippingInsurance)}
                </span>
              </div>
            )}
            {payment.taxAmount > 0 && (
              <div className="flex justify-between items-center p-3">
                <span className="font-semibold text-xs">
                  Sales Tax (shipping)
                </span>
                <span className="text-xs">
                  {formatCurrency(payment.taxAmount)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center p-3 font-bold text-success">
              <span>Total</span>
              <span>{formatCurrency(payment.totalAmount)}</span>
            </div>
          </div>
        </section>
      </>
    );
  };

  return (
    <div className="space-y-5">
      {/* Admin Page Header */}
      <AdminManagementHeader
        title="Order Management"
        description="View and manage all orders placed by users"
      />

      {/* Table Layout */}
      <TableLayout
        searchPlaceholder="Search orders..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        entriesValue={limit}
        onEntriesChange={handleLimitChange}
        page={page}
        onPageChange={handlePageChange}
        totalItems={totalItems}
        totalPages={totalPages}
        startItem={startItem}
        endItem={endItem}
        onPrevious={handlePrevious}
        onNext={handleNext}
        columns={columns}
        data={orderGroups}
        isLoading={isLoadingOrders}
        searchExtra={
          <>
          <Select
            value={statusFilter || "all"}
            onValueChange={handleStatusFilterChange}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
              <SelectItem value={CONSOLIDATED_FILTER.value}>
                {CONSOLIDATED_FILTER.label}
              </SelectItem>
              <SelectItem value={BACKORDER_FILTER.value}>
                {BACKORDER_FILTER.label}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setBackorderReportOpen(true)}
          >
            <ClipboardList className="size-4" />
            Backorder Report
          </Button>
          </>
        }
        renderRow={(group) =>
          group.type === "shipment"
            ? renderShipmentCells(group)
            : renderOrderCells(group.order)
        }
        renderExpanded={(group) =>
          group.type === "shipment"
            ? expandedShipments[group._id] &&
              group.orders.map((order) => (
                <React.Fragment key={order._id}>
                  <tr className="border-t border-dashed text-sm bg-muted/40">
                    {renderOrderCells(order, {
                      nested: true,
                      parcel: group.shipment,
                    })}
                  </tr>
                  {renderBackorderRows(order)}
                </React.Fragment>
              ))
            : renderBackorderRows(group.order)
        }
      />

      {/* Update Order Status Dialog */}
      <AddUpdateItemDialog
        pinTitleAndButtons
        open={statusModalOpen}
        onOpenChange={handleStatusModalChange}
        mode="edit"
        title="Update Order Status"
        description={orderReference ? `Order #${orderReference}` : undefined}
        onSubmit={handleStatusFormSubmit}
        isLoading={isUpdatingStatus}
        submitButtonText={
          newStatus === "cancelled" ? "Confirm Cancellation" : "Update Status"
        }
      >
        <div className="space-y-4">
          {/* Status Select */}
          <AdminFormSelect
            label="Update Status"
            name="newStatus"
            value={newStatus}
            onValueChange={setNewStatus}
            options={
              isSelectedHeld
                ? [
                    // Shown but locked — it unlocks once the customer pays
                    // for shipping and the order moves to Paid.
                    { value: "shipped", label: "Shipped", disabled: true },
                    ...getAvailableTransitions(selectedOrder?.status),
                  ]
                : getAvailableTransitions(
                    selectedOrder?.status,
                    allowedStatuses,
                  )
            }
            placeholder="Select status"
            isLoading={isLoadingConfig}
            disabled={isUpdatingStatus}
          />

          {isSelectedHeld && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
              <Archive className="size-4 shrink-0 mt-0.5" />
              <p>
                <span className="font-bold">Held — ships later.</span> The order
                is on hold at the customer's request and will be shipped with
                other orders. Once the customer requests shipping and pays the
                shipping fee, the order status will update to Paid and can then
                be marked as Shipped.
              </p>
            </div>
          )}

          {/* Shipping Fields */}
          {newStatus === "shipped" && (
            <>
              {getOrderShipment(selectedOrder)?.orders?.length > 1 && (
                <div className="flex items-start gap-2 rounded-md border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 p-3 text-sm text-blue-800 dark:text-blue-300">
                  <Boxes className="size-4 shrink-0 mt-0.5" />
                  <p>
                    <span className="font-bold">Consolidated shipment.</span>{" "}
                    These tracking details apply to every order in the parcel,
                    and the customer gets one shipping email.
                  </p>
                </div>
              )}
              <AdminFormInput
                label="Carrier"
                name="carrier"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="USPS, UPS, FedEx..."
                disabled={isUpdatingStatus}
                required
              />

              <AdminFormInput
                label="Tracking Number"
                name="trackingNumber"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="1Z999AA10123456784"
                disabled={isUpdatingStatus}
                required
              />

              <AdminFormInput
                label="Tracking Link"
                name="trackingLink"
                value={trackingLink}
                onChange={(e) => setTrackingLink(e.target.value)}
                placeholder="https://tracking.example.com/..."
                disabled={isUpdatingStatus}
                required
              />
            </>
          )}

          {/* Delivery Fields — hand delivery / in-store pick-up only. Shipped
              orders never reach here: they have no onward transition, so
              "Mark as Delivered" is not offered for them. */}
          {newStatus === "delivered" && (
            <>
              <AdminFormSelect
                label="Delivery Method"
                name="deliveryMethod"
                value={deliveryMethod}
                onValueChange={setDeliveryMethod}
                options={deliveryMethodOptions}
                placeholder="Select delivery method"
                isLoading={isLoadingConfig}
                disabled={isUpdatingStatus}
              />

              <AdminFormInput
                label="Received By"
                name="receivedBy"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                placeholder="Name of the person who received it"
                disabled={isUpdatingStatus}
              />

              <AdminFormTextarea
                label="Delivery notes"
                name="deliveryNotes"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Optional notes..."
                disabled={isUpdatingStatus}
              />
            </>
          )}

          {/* Cancellation Fields */}
          {newStatus === "cancelled" && (
            <>
              {getOrderShipment(selectedOrder)?.status === "paid" && (
                <div className="flex items-start gap-2 rounded-md border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-800 dark:text-blue-300">
                  <Boxes className="size-4 shrink-0 mt-0.5" />
                  <p>
                    <span className="font-bold">
                      In Shipment #
                      {getShipmentRef(getOrderShipment(selectedOrder))}.
                    </span>{" "}
                    Cancelling removes this order from the parcel — the other
                    orders still ship together.
                  </p>
                </div>
              )}
              <AdminFormInput
                label="Reason for cancellation"
                name="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Out of stock, customer request..."
                disabled={isUpdatingStatus}
                required
              />

              <AdminFormTextarea
                label="Additional notes"
                name="cancelNotes"
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                placeholder="Optional internal notes..."
                disabled={isUpdatingStatus}
                required
              />

              <p className="text-xs text-muted-foreground">
                A reason is required. This will initiate a refund.
              </p>
            </>
          )}
        </div>
      </AddUpdateItemDialog>

      {/* View Order Details Dialog */}
      <ViewAdminDialog
        pinTitleAndButtons
        open={viewModalOpen}
        onOpenChange={handleViewModalChange}
        title="Order Details"
        className="sm:max-w-4xl"
        footerActions={
          <Button onClick={() => exportOrderToPdf(viewOrder)}>Export</Button>
        }
      >
        {renderOrderDetails(withBackorderUpdate(viewOrder))}
      </ViewAdminDialog>

      {/* View Backorder Shipment Dialog — one later shipment of an order */}
      {(() => {
        const order = withBackorderUpdate(viewBackorder?.order);
        const generation = viewBackorder?.generation;
        const onlyThis = order && {
          ...order,
          backorders: (order.backorders || []).filter(
            (b) => (b.generation || 2) === generation,
          ),
        };
        const waiting = onlyThis?.backorders.some(
          (b) => b.status === "awaiting",
        );
        return (
          <ViewAdminDialog
            pinTitleAndButtons
            open={Boolean(viewBackorder)}
            onOpenChange={(open) => !open && setViewBackorder(null)}
            title={
              order
                ? `Order #${getInvoiceNumber(order) || order._id?.substring(0, 7)} · Shipment ${generation}`
                : "Shipment"
            }
            footerActions={
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewBackorder(null);
                    handleView(viewBackorder.order);
                  }}
                >
                  View Order
                </Button>
                {waiting && canShipBackorder(order) && (
                  <Button onClick={() => setShipBackorderOrder(order)}>
                    Mark as Shipped
                  </Button>
                )}
              </>
            }
          >
            {order && (
              <>
                {renderCustomerSection(order)}
                {renderShippingAddressSection(order)}
                {onlyThis.backorders.length ? (
                  <BackorderShipments order={onlyThis} admin />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This shipment no longer has any items. They were refunded
                    or taken off the backorder.
                  </p>
                )}
                {waiting && !canShipBackorder(order) && (
                  <p className="text-xs text-muted-foreground">
                    These items can be marked as shipped once the rest of the
                    order has shipped.
                  </p>
                )}
              </>
            )}
          </ViewAdminDialog>
        );
      })()}

      {/* View Shipment Dialog — the parcel and every order inside it */}
      <ViewAdminDialog
        pinTitleAndButtons
        open={Boolean(viewShipment)}
        onOpenChange={(open) => {
          if (!open) setOpenParcelOrders({});
          handleViewShipmentChange(open);
        }}
        title={
          viewShipment
            ? `Shipment #${getShipmentRef(viewShipment.shipment)}`
            : "Shipment Details"
        }
        className="sm:max-w-2xl"
        footerActions={
          <Button
            onClick={() =>
              exportShipmentToPdf(viewShipment?.shipment, viewShipment?.orders)
            }
          >
            Export
          </Button>
        }
      >
        {viewShipment && renderShipmentDetails(viewShipment)}
      </ViewAdminDialog>

      {/* Backorders */}
      <BackorderDialog
        open={Boolean(backorderOrder)}
        onOpenChange={(open) => !open && setBackorderOrder(null)}
        order={backorderOrder}
        onSaved={handleBackorderSaved}
      />
      <ShipBackorderDialog
        open={Boolean(shipBackorderOrder)}
        onOpenChange={(open) => !open && setShipBackorderOrder(null)}
        order={shipBackorderOrder}
        onSaved={handleBackorderSaved}
      />
      <BackorderReportDialog
        open={backorderReportOpen}
        onOpenChange={setBackorderReportOpen}
      />

      {/* Refunds */}
      <RefundDialog
        open={Boolean(refundOrder)}
        onOpenChange={(open) => !open && setRefundOrder(null)}
        order={refundOrder}
        onSaved={handleRefundSaved}
      />
    </div>
  );
};

export default OrderManagement;
