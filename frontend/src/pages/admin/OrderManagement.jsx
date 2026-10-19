import React from "react";
import { Archive, Boxes, Check, ChevronRight, Copy } from "lucide-react";
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
  STATUS_CONFIG,
} from "@/constant/orderData";
import useOrderManagement from "@/hooks/admin/useOrderManagement";
import OrderItemRow from "@/components/shared/OrderItemRow";
import { perBagUnit } from "@shared/inventoryData";

// Small inline button that copies the given text and briefly shows a check.
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

  // Shipment view: which orders are expanded to their full details.
  const [openParcelOrders, setOpenParcelOrders] = React.useState({});
  const toggleParcelOrder = (id) =>
    setOpenParcelOrders((prev) => ({ ...prev, [id]: !prev[id] }));

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

    return (
      <>
        {/* Invoice */}
        <TableCell maxWidth="160px" className="font-mono text-xs">
          {nested && <span className="text-muted-foreground mr-1">↳</span>}
          {invoice}
        </TableCell>

        {/* Customer */}
        <TableCell maxWidth="180px">{formatFullName(order.userId)}</TableCell>

        {/* Email */}
        <TableCell>{display(order.email)}</TableCell>

        {/* Order Type */}
        <TableCell className="capitalize">{display(order.orderType)}</TableCell>

        {/* Total */}
        <PriceCell amount={order.payment?.totalAmount} />

        {/* Payment Method */}
        <TableCell>{getPaymentGatewayLabel(order)}</TableCell>

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

        {/* Shipping paid */}
        <PriceCell amount={shipment.payment?.totalAmount} />

        {/* Payment Method — how shipping was paid */}
        <TableCell>{getPaymentGatewayLabel(shipment)}</TableCell>

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
      {/* ── Order Information ── */}
      <section className="space-y-2 mt-2">
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

      {!inShipment && (
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
      )}

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

      {!inShipment && (
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
                        {fullAddress && <CopyButton value={fullAddress} />}
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
                  <CopyButton value={fullAddress} />
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
                    {renderOrderDetails(order, { inShipment: true })}
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
            </SelectContent>
          </Select>
        }
        renderRow={(group) =>
          group.type === "shipment"
            ? renderShipmentCells(group)
            : renderOrderCells(group.order)
        }
        renderExpanded={(group) =>
          group.type === "shipment" &&
          expandedShipments[group._id] &&
          group.orders.map((order) => (
            <tr
              key={order._id}
              className="border-t border-dashed text-sm bg-muted/40"
            >
              {renderOrderCells(order, {
                nested: true,
                parcel: group.shipment,
              })}
            </tr>
          ))
        }
      />

      {/* Update Order Status Dialog */}
      <AddUpdateItemDialog
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
        open={viewModalOpen}
        onOpenChange={handleViewModalChange}
        title="Order Details"
        footerActions={
          <Button onClick={() => exportOrderToPdf(viewOrder)}>Export</Button>
        }
      >
        {renderOrderDetails(viewOrder)}
      </ViewAdminDialog>

      {/* View Shipment Dialog — the parcel and every order inside it */}
      <ViewAdminDialog
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
    </div>
  );
};

export default OrderManagement;
