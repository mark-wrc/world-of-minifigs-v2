import React from "react";
import { Label } from "@/components/ui/label";
import AdminManagementHeader from "@/components/shared/AdminManagementHeader";
import TableLayout from "@/components/table/TableLayout";
import {
  ActionsColumn,
  TableCell,
  TimestampCells,
  StatusCell,
  PriceCell,
} from "@/components/table/BaseColumn";
import AddUpdateItemDialog from "@/components/table/AddUpdateItemDialog";
import {
  AdminFormInput,
  AdminFormTextarea,
  AdminFormSelect,
} from "@/components/shared/AdminFormInput";
import StatusBadge from "@/components/shared/StatusBadge";
import ViewAdminDialog from "@/components/table/ViewAdminDialog";
import {
  formatCurrency,
  formatDate,
  display,
  formatFullName,
} from "@/utils/formatting";
import { getOrderStatusConfig } from "@/constant/orderData";
import useOrderManagement from "@/hooks/admin/useOrderManagement";

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
              <StatusCell variant={statusConfig.variant}>
                {statusConfig.label}
              </StatusCell>

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
                  {viewOrder?.payment?.stripeInvoiceNumber || "—"}
                </span>
              )}
            </div>
            <div className="grid grid-cols-[140px_1fr] p-3">
              <span className="font-semibold text-xs">Status</span>
              <div className="flex items-center">
                <StatusBadge variant={getOrderStatusConfig(viewOrder).variant}>
                  {getOrderStatusConfig(viewOrder).label}
                </StatusBadge>
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
            </div>
          </section>
        )}

        {/* ── Shipping & Tracking ── */}
        {viewOrder?.shipping?.carrier && (
          <section className="space-y-2">
            <Label className="font-semibold text-xs uppercase">
              Shipping & Tracking
            </Label>
            <div className="rounded-lg border divide-y text-sm">
              <div className="grid grid-cols-[140px_1fr] p-3">
                <span className="font-semibold text-xs">Carrier</span>
                <span className="text-xs">
                  {viewOrder.shipping.carrier || "—"}
                </span>
              </div>
              <div className="grid grid-cols-[140px_1fr] p-3">
                <span className="font-semibold text-xs">Tracking Number</span>
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
            {viewOrder?.orderType === "dealer" ? "Order Manifest" : "Items"}
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
              {/* Bundle */}
              <div className="rounded-lg border bg-muted/30">
                <div className="p-3 border-b bg-muted/50 font-bold text-[10px] uppercase tracking-wider">
                  Selected Bundle
                </div>
                <div className="p-3 grid grid-cols-[1fr_auto] items-center">
                  <span className="text-xs">
                    {viewOrder.dealerItems.bundle?.name}
                  </span>
                  <span className="text-xs font-semibold">
                    {formatCurrency(viewOrder.dealerItems.bundle?.price)}
                  </span>
                </div>
              </div>

              {/* Torso Bag */}
              {viewOrder.dealerItems.torsoBag && (
                <div className="rounded-lg border border-dashed">
                  <div className="p-3 border-b font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
                    Included Torso Bag
                  </div>
                  <div className="p-3 grid grid-cols-[1fr_auto] items-center">
                    <span className="text-xs">
                      {viewOrder.dealerItems.torsoBag.name}
                    </span>
                    <span className="text-xs font-bold text-success capitalize">
                      {viewOrder.dealerItems.torsoBag.multiplier}x Included
                    </span>
                  </div>
                </div>
              )}

              {/* Addons */}
              {viewOrder.dealerItems.addons?.length > 0 && (
                <div className="rounded-lg border">
                  <div className="p-3 border-b bg-muted/20 font-bold text-[10px] uppercase tracking-wider">
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
                          <div className="pl-4 border-l-2 border-muted space-y-1">
                            {addon.subItems.map((sub, sIdx) => (
                              <div
                                key={sIdx}
                                className="text-[11px] text-muted-foreground grid grid-cols-[1fr_auto] gap-2"
                              >
                                <span>↳ {sub.name}</span>
                                <span>{sub.qty} bags</span>
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
                <div className="rounded-lg border border-accent/20">
                  <div className="p-3 border-b bg-accent/5 font-bold text-[10px] uppercase tracking-wider text-accent">
                    Extra Part Bags
                  </div>
                  <div className="divide-y">
                    {viewOrder.dealerItems.extraBags.map((bag, idx) => (
                      <div
                        key={idx}
                        className="p-3 grid grid-cols-[1fr_auto_auto] gap-4 items-center"
                      >
                        <span className="text-xs">{bag.name}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {bag.quantity} × {formatCurrency(bag.price)}
                        </span>
                        <span className="text-xs font-semibold">
                          {formatCurrency(bag.quantity * bag.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Payment Summary ── */}
        <section className="space-y-2">
          <Label className="font-semibold text-xs uppercase">
            Payment Summary
          </Label>
          <div className="rounded-lg border divide-y text-sm">
            <div className="grid grid-cols-[140px_1fr] p-3">
              <span className="font-semibold text-xs">Subtotal</span>
              <span className="text-xs">
                {formatCurrency(viewOrder?.payment?.subtotal)}
              </span>
            </div>
            <div className="grid grid-cols-[140px_1fr] p-3">
              <span className="font-semibold text-xs">Shipping Fee</span>
              <span className="text-xs">
                {formatCurrency(viewOrder?.payment?.shippingFee)}
              </span>
            </div>
            <div className="grid grid-cols-[140px_1fr] p-3">
              <span className="font-semibold text-xs">Tax</span>
              <span className="text-xs">
                {formatCurrency(viewOrder?.payment?.taxAmount ?? 0)}
              </span>
            </div>
            <div className="grid grid-cols-[140px_1fr] p-3 font-semibold">
              <span>Total</span>
              <span>{formatCurrency(viewOrder?.payment?.totalAmount)}</span>
            </div>
          </div>
        </section>

        {/* ── Refund ── */}
        {viewOrder?.refund?.status && viewOrder.refund.status !== "none" && (
          <section className="space-y-2">
            <Label className="font-semibold text-xs uppercase">Refund</Label>
            <div className="rounded-lg border divide-y text-sm">
              <div className="grid grid-cols-[140px_1fr] p-3">
                <span className="font-semibold text-xs">Status</span>
                <span className="text-xs capitalize">
                  {viewOrder.refund.status || "—"}
                </span>
              </div>
              {viewOrder.refund.amount != null && (
                <div className="grid grid-cols-[140px_1fr] p-3">
                  <span className="font-semibold text-xs">Amount</span>
                  <span className="text-xs">
                    {formatCurrency(viewOrder.refund.amount)}
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Cancellation ── */}
        {viewOrder?.cancellation?.reason && (
          <section className="space-y-2">
            <Label className="font-semibold text-xs uppercase text-destructive">
              Cancellation
            </Label>
            <div className="rounded-lg border divide-y text-sm">
              <div className="grid grid-cols-[140px_1fr] p-3">
                <span className="font-semibold text-xs">Reason</span>
                <span className="text-xs">
                  {viewOrder.cancellation.reason || "—"}
                </span>
              </div>
              <div className="grid grid-cols-[140px_1fr] p-3">
                <span className="font-semibold text-xs">Cancelled By</span>
                <span className="text-xs capitalize">
                  {viewOrder.cancellation.cancelledByRole || "—"}
                </span>
              </div>
            </div>
          </section>
        )}
      </ViewAdminDialog>
    </div>
  );
};

export default OrderManagement;
