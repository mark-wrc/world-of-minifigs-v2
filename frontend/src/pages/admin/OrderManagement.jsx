import React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import AdminManagementHeader from "@/components/shared/AdminManagementHeader";
import TableLayout from "@/components/table/TableLayout";
import { exportOrderToPdf } from "@/utils/exportOrderPdf";
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
import { getOrderStatusConfig } from "@/constant/orderData";
import useOrderManagement from "@/hooks/admin/useOrderManagement";
import CommonImage from "@/components/shared/CommonImage";

const OrderManagement = () => {
  const {
    page,
    limit,
    search,
    orders,
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
    newStatus,
    carrier,
    trackingNumber,
    trackingLink,
    cancelReason,
    cancelNotes,
    isUpdatingStatus,
    viewModalOpen,
    viewOrder,
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
    handleEdit,
    handleView,
    getAvailableTransitions,
    isLoadingConfig,
    handleStatusModalChange,
    handleViewModalChange,
    handleStatusFormSubmit,
  } = useOrderManagement();

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
        data={orders}
        isLoading={isLoadingOrders}
        renderRow={(order) => {
          const invoice =
            order.payment?.stripeInvoiceNumber || order._id?.substring(0, 7);
          const transitions = getAvailableTransitions(order.status);
          const statusConfig = getOrderStatusConfig(order);

          return (
            <>
              {/* Invoice */}
              <TableCell maxWidth="140px" className="font-mono text-xs">
                {invoice}
              </TableCell>

              {/* Customer */}
              <TableCell maxWidth="180px">
                {formatFullName(order.userId)}
              </TableCell>

              {/* Email */}
              <TableCell>{display(order.email)}</TableCell>

              {/* Recipient */}
              <TableCell maxWidth="180px">
                {display(order.shipping?.address?.name)}
              </TableCell>

              {/* Order Type */}
              <TableCell className="capitalize">
                {display(order.orderType)}
              </TableCell>

              {/* Total */}
              <PriceCell amount={order.payment?.totalAmount} />

              {/* Status */}
              <TableCell>
                <Badge className={`font-medium ${statusConfig.iconColor}`}>
                  {statusConfig.label}
                </Badge>
              </TableCell>

              {/* ARN */}
              <TableCell maxWidth="200px" className="font-mono text-xs">
                {order.refund?.status === "completed" && order.refund?.arn
                  ? order.refund.arn
                  : "—"}
              </TableCell>

              {/* Created At */}
              <TimestampCells createdAt={order.createdAt} />

              {/* Actions */}
              <ActionsColumn
                onView={() => handleView(order)}
                onEdit={
                  transitions.length > 0 ? () => handleEdit(order) : undefined
                }
                onExport={() => exportOrderToPdf(order)}
              />
            </>
          );
        }}
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
            options={getAvailableTransitions(selectedOrder?.status)}
            placeholder="Select status"
            isLoading={isLoadingConfig}
            disabled={isUpdatingStatus}
          />

          {/* Shipping Fields */}
          {newStatus === "shipped" && (
            <>
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

          {/* Cancellation Fields */}
          {newStatus === "cancelled" && (
            <>
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
        {/* ── Order Information ── */}
        <section className="space-y-2">
          <Label className="font-semibold text-xs uppercase">
            Order Information
          </Label>
          <div className="rounded-lg border divide-y text-sm">
            <div className="grid grid-cols-[140px_1fr] p-3">
              <span className="font-semibold text-xs">Invoice Number</span>
              {viewOrder?.payment?.invoiceUrl &&
              viewOrder?.payment?.stripeInvoiceNumber ? (
                <a
                  href={viewOrder.payment.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline underline-offset-2"
                >
                  {viewOrder.payment.stripeInvoiceNumber}
                </a>
              ) : (
                <span className="text-xs">
                  {viewOrder?.payment?.stripeInvoiceNumber ||
                    viewOrder?._id?.substring(0, 7) ||
                    "—"}
                </span>
              )}
            </div>
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
          </div>
        </section>

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

        {/* ── Billing Details ── */}
        {(viewOrder?.billing?.cardHolderName ||
          viewOrder?.billing?.country) && (
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
                <span className="text-xs">
                  {[
                    viewOrder?.shipping?.address?.line1,
                    viewOrder?.shipping?.address?.line2,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </span>
              </div>
              <div className="grid grid-cols-[140px_1fr] p-3">
                <span className="font-semibold text-xs">City</span>
                <span className="text-xs">
                  {viewOrder?.shipping?.address?.city || "—"}
                </span>
              </div>
              <div className="grid grid-cols-[140px_1fr] p-3">
                <span className="font-semibold text-xs">State</span>
                <span className="text-xs">
                  {viewOrder?.shipping?.address?.state || "—"}
                </span>
              </div>
              <div className="grid grid-cols-[140px_1fr] p-3">
                <span className="font-semibold text-xs">Postal Code</span>
                <span className="text-xs">
                  {viewOrder?.shipping?.address?.postalCode || "—"}
                </span>
              </div>
              <div className="grid grid-cols-[140px_1fr] p-3">
                <span className="font-semibold text-xs">Country</span>
                <span className="text-xs">
                  {viewOrder?.shipping?.address?.country || "—"}
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

        {/* ── Order Items ── */}
        <section className="space-y-2">
          <Label className="font-semibold text-xs uppercase">
            {viewOrder?.orderType === "dealer" ? "Order Details" : "Items"}
          </Label>

          {/* Standard Product View */}
          {(viewOrder?.orderType === "product" || viewOrder?.productItems) && (
            <div className="rounded-lg border divide-y text-sm">
              {(viewOrder.productItems || viewOrder.items || []).map(
                (item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_auto_auto] gap-4 items-center p-3"
                  >
                    <span className="text-xs truncate">{item.productName}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                      {item.unitPrice < item.basePrice && (
                        <span className="text-[10px] line-through text-muted-foreground/50 ml-1">
                          {formatCurrency(item.basePrice)}
                        </span>
                      )}
                    </span>
                    <span className="text-xs font-semibold whitespace-nowrap">
                      {formatCurrency(item.totalPrice)}
                    </span>
                  </div>
                ),
              )}
            </div>
          )}

          {/* Dealer Manifest View */}
          {viewOrder?.orderType === "dealer" && viewOrder.dealerItems && (
            <div className="space-y-4">
              {/* Bundle + Torso Bags */}
              <div className="rounded-lg border">
                <div className="p-3 border-b font-semibold text-xs bg-success/20 rounded-t-md">
                  Selected Bundle
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-xs font-medium">
                    {viewOrder.dealerItems.bundle?.name}
                  </span>
                  <span className="text-xs font-bold text-success dark:text-accent">
                    {formatCurrency(viewOrder.dealerItems.bundle?.price)}
                  </span>
                </div>

                {/* Torso bags */}
                {viewOrder.dealerItems.torsoBags?.length > 0 && (
                  <div className="border-t px-3 py-2 space-y-3">
                    {viewOrder.dealerItems.torsoBags.map((tb, i) => (
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
                          <span className="font-semibold">{addon.name}</span>
                          <span className="font-bold text-success dark:text-accent">
                            {addon.totalPrice > 0
                              ? formatCurrency(addon.totalPrice)
                              : "Free"}
                          </span>
                        </div>
                        {addon.subItems?.length > 0 && (
                          <div className="space-y-2 mt-1">
                            {addon.subItems.map((sub, sIdx) => (
                              <div
                                key={sIdx}
                                className="flex items-center gap-3 rounded-md border p-2"
                              >
                                {sub.imageUrl && (
                                  <CommonImage
                                    src={sub.imageUrl}
                                    alt={sub.name}
                                    className="w-14 object-contain shrink-0"
                                  />
                                )}
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold truncate">
                                      {sub.name}
                                    </p>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                      {sub.qty}{" "}
                                      {/minifig/i.test(addon.name)
                                        ? sub.qty !== 1
                                          ? "minifigs"
                                          : "minifig"
                                        : sub.qty !== 1
                                          ? "bags"
                                          : "bag"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs">
                                    {sub.colorName && (
                                      <span className="text-muted-foreground">
                                        {sub.colorName}
                                      </span>
                                    )}
                                    {sub.colorName && sub.totalPrice > 0 && (
                                      <span className="text-muted-foreground">
                                        ·
                                      </span>
                                    )}
                                    {sub.totalPrice > 0 && (
                                      <span className="font-semibold text-success dark:text-accent">
                                        {formatCurrency(sub.totalPrice)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
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
              {viewOrder.refund?.stripeRefundId && (
                <div className="flex justify-between items-start p-3 gap-4">
                  <span className="font-semibold text-xs shrink-0">
                    Refund ID
                  </span>
                  <span className="text-xs text-right font-mono">
                    {viewOrder.refund.stripeRefundId}
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
            <div className="flex justify-between items-center p-3">
              <span className="font-semibold text-xs">Shipping Fee</span>
              <span className="text-xs">
                {formatCurrency(viewOrder?.payment?.shippingFee)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3">
              <span className="font-semibold text-xs">Sales Tax</span>
              <span className="text-xs">
                {formatCurrency(viewOrder?.payment?.taxAmount ?? 0)}
              </span>
            </div>
            <div
              className={`flex justify-between items-center p-3 font-bold ${viewOrder?.status === "cancelled" ? "text-destructive" : "text-success"}`}
            >
              <span>
                {viewOrder?.status === "cancelled" ? "Refund Amount" : "Total"}
              </span>
              <span>
                {formatCurrency(
                  viewOrder?.status === "cancelled"
                    ? viewOrder?.refund?.amount ||
                        viewOrder?.payment?.totalAmount
                    : viewOrder?.payment?.totalAmount,
                )}
              </span>
            </div>
          </div>
        </section>
      </ViewAdminDialog>
    </div>
  );
};

export default OrderManagement;
