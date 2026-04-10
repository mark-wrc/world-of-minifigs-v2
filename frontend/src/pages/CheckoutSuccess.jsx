import React from "react";
import { Link } from "react-router-dom";
import { Download, Copy, Check, MapPin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import ErrorState from "@/components/shared/ErrorState";
import CancelOrderModal from "@/components/products/CancelOrderModal";
import CommonImage from "@/components/shared/CommonImage";
import ColorSwatch from "@/components/shared/ColorSwatch";
import Logo from "@/assets/media/Logo.png";
import { formatCurrency, formatDate } from "@/utils/formatting";
import useCheckoutSuccess from "@/hooks/useCheckoutSuccess";

const CheckoutSuccess = () => {
  const {
    sessionId,
    orderId,
    order,
    displayItems,
    isLoading,
    isError,
    copied,
    invoiceLabel,
    invoiceValue,
    copyToClipboard,
    status,
    statusConfig,
    canCancel,
    cancellationReasons,
    cancelModalOpen,
    cancelReason,
    cancelNotes,
    isCancelling,
    isCancelValid,
    setCancelReason,
    setCancelNotes,
    onCancelModalChange,
    handleCancelOrder,
  } = useCheckoutSuccess();

  if (!sessionId && !orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSpinner minHeight="min-h-screen" />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Order Information Unavailable"
        description={
          <div className="space-y-4 max-w-xl mx-auto">
            <p>
              We encountered a temporary issue while retrieving the latest
              status of your order request. Please try refreshing this page in a
              few moments.
            </p>
          </div>
        }
        minHeight="min-h-screen"
      />
    );
  }

  const isDealer = order?.orderType === "dealer";
  const di = order?.dealerItems;

  // Resolve torso bags: prefer new array format, fall back to legacy single entry
  const torsoBags =
    di?.torsoBags?.length > 0
      ? di.torsoBags
      : di?.torsoBag
        ? [{ name: di.torsoBag.name, quantity: di.torsoBag.multiplier }]
        : [];

  return (
    <div className="px-5 py-10">
      {/* Header Section */}
      <div className="text-center space-y-5">
        <div
          className={`size-16 mx-auto rounded-full flex items-center justify-center ring-10 ${statusConfig.iconColor}`}
        >
          <statusConfig.icon className="size-8" strokeWidth={2.5} />
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight">
            {statusConfig.header}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mx-auto max-w-xl">
            {statusConfig.description}
            {status === "paid" && order?.email && (
              <span className="font-bold text-foreground">{order.email}</span>
            )}
          </p>
        </div>

        <div className="justify-center items-center space-y-3">
          {/* Order ID Badge */}
          <Badge
            variant="outline"
            onClick={() => copyToClipboard(invoiceValue)}
            className="inline-flex items-center gap-2 px-5 py-2 font-bold cursor-pointer tracking-wider uppercase"
          >
            <span>Invoice #{invoiceLabel}</span>
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
          </Badge>
        </div>
      </div>

      {/* Header for Items */}
      <div className="my-5 flex flex-wrap gap-4 items-end justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          {status === "cancelled" ? "Cancelled Items" : "Order Details"}
        </h2>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Items */}
        <div className="lg:col-span-8 space-y-5">
          <div className="space-y-3">
            {/* ── Dealer Order Layout ── */}
            {isDealer && di && (
              <>
                {/* Selected Bundle Card */}
                {di.bundle && (
                  <Card>
                    <CardContent className="space-y-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Selected Bundle
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-base">
                          {di.bundle.name}
                        </span>
                        <span className="font-bold text-base text-success dark:text-accent whitespace-nowrap">
                          {formatCurrency(di.bundle.price)}
                        </span>
                      </div>

                      {/* Torso Bags */}
                      {torsoBags.length > 0 && (
                        <div className="pt-2 border-t border-dashed space-y-2">
                          {torsoBags.map((tb, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="font-medium">{tb.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ×{tb.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Add-ons — single card, one section per addon */}
                {di.addons?.length > 0 && (
                  <Card>
                    <CardContent className="space-y-4">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Add-ons
                      </p>
                      {di.addons.map((addon, i) => (
                        <div key={i} className={i > 0 ? "pt-4 border-t border-dashed" : ""}>
                          {/* Addon name + price */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-bold text-sm">{addon.name}</span>
                            <span className="font-bold text-sm text-success dark:text-accent whitespace-nowrap">
                              {addon.totalPrice > 0 ? formatCurrency(addon.totalPrice) : "Free"}
                            </span>
                          </div>

                          {/* Sub-items */}
                          {addon.subItems?.length > 0 && (
                            <div className="space-y-2">
                              {addon.subItems.map((sub, j) => (
                                <div
                                  key={j}
                                  className="flex items-center gap-3 rounded-md border p-2"
                                >
                                  {sub.imageUrl && (
                                    <CommonImage
                                      src={sub.imageUrl}
                                      alt={sub.name}
                                      className="size-12 object-contain shrink-0"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-semibold truncate">
                                        {sub.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground shrink-0">
                                        {sub.qty} bag{sub.qty !== 1 ? "s" : ""}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs">
                                      {sub.colorName && (
                                        <span className="text-muted-foreground">{sub.colorName}</span>
                                      )}
                                      {sub.colorName && sub.totalPrice > 0 && (
                                        <span className="text-muted-foreground">·</span>
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
                    </CardContent>
                  </Card>
                )}

                {/* Extra Bags Card */}
                {di.extraBags?.length > 0 && (
                  <Card>
                    <CardContent className="space-y-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Extra Bags
                      </p>
                      <div className="space-y-3">
                        {di.extraBags.map((eb, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <span className="font-semibold">
                              {eb.name}{" "}
                              <span className="text-muted-foreground font-normal">
                                ({eb.quantity} bag{eb.quantity !== 1 ? "s" : ""}
                                )
                              </span>
                            </span>
                            {eb.price > 0 && (
                              <span className="font-semibold text-success dark:text-accent whitespace-nowrap">
                                {formatCurrency(eb.price * eb.quantity)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* ── Product Order Layout ── */}
            {!isDealer &&
              displayItems?.map((item, index) => (
                <Card key={index}>
                  <CardContent className="flex gap-3 items-center">
                    {item.imageUrl && (
                      <CommonImage
                        src={item.imageUrl}
                        alt={item.productName}
                        className="w-28"
                      />
                    )}
                    <div className="flex-1 flex flex-col justify-between self-stretch">
                      <div className="grid grid-cols-[1fr_auto] items-start">
                        {item.productId ? (
                          <Link
                            to={`/products/${item.productId}`}
                            className="font-bold text-md line-clamp-2 hover:text-success transition-colors"
                          >
                            {item.productName}
                          </Link>
                        ) : (
                          <span className="font-bold text-md line-clamp-2">
                            {item.productName}
                          </span>
                        )}
                        <span className="font-bold text-lg text-success dark:text-accent whitespace-nowrap">
                          {formatCurrency(item.totalPrice)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {item.description && (
                          <p className="text-xs text-muted-foreground font-medium">
                            {item.description}
                          </p>
                        )}
                        <div className="text-xs font-bold text-muted-foreground">
                          Qty: {item.quantity}
                        </div>
                        {item.unitPrice > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-md font-bold text-success dark:text-accent">
                              {formatCurrency(item.unitPrice)}
                            </span>
                            {item.unitPrice < item.basePrice && (
                              <span className="text-xs text-muted-foreground line-through">
                                {formatCurrency(item.basePrice)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Bottom Card: Shipping Details (non-cancelled only) */}
          {status !== "cancelled" && (
            <Card>
              <CardContent>
                <div className="flex items-center gap-3 text-success font-bold uppercase text-sm tracking-widest pb-5 border-b border-dashed">
                  <MapPin className="h-4 w-4" />
                  Shipping Details
                </div>
                <div className="space-y-10 mt-5">
                  {/* DELIVERY ADDRESS */}
                  <div className="space-y-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Delivery Address
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <p className="text-xs uppercase text-muted-foreground">
                          Recipient
                        </p>
                        <p className="text-base font-semibold">
                          {order?.shipping?.address?.name || "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase text-muted-foreground">
                          Street Address
                        </p>
                        <p className="text-base font-semibold">
                          {order?.shipping?.address?.line1 || "—"}
                        </p>
                        {order?.shipping?.address?.line2 && (
                          <p className="text-base font-semibold">
                            {order?.shipping?.address?.line2}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase text-muted-foreground">
                          City & Country
                        </p>
                        <p className="text-base font-semibold">
                          {order?.shipping?.address?.city || "—"},{" "}
                          {order?.shipping?.address?.country || "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase text-muted-foreground">
                          State
                        </p>
                        <p className="text-base font-semibold">
                          {order?.shipping?.address?.state || "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase text-muted-foreground">
                          Postal Code
                        </p>
                        <p className="text-base font-semibold">
                          {order?.shipping?.address?.postalCode || "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* BILLING DETAILS */}
                  {(order?.billing?.cardHolderName ||
                    order?.billing?.country) && (
                    <div className="space-y-5">
                      <div className="border-t pt-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Billing Details
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                          <p className="text-xs uppercase text-muted-foreground">
                            Cardholder Name
                          </p>
                          <p className="text-base font-semibold">
                            {order.billing.cardHolderName || "—"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs uppercase text-muted-foreground">
                            Country
                          </p>
                          <p className="text-base font-semibold">
                            {order.billing.country || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SHIPMENT INFORMATION */}
                  {(status === "shipped" || status === "delivered") && (
                    <div className="space-y-5">
                      <div className="border-t pt-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Shipment Information
                        </p>
                      </div>
                      {order?.shipping?.trackingLink ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-muted-foreground">
                              Carrier
                            </p>
                            <p className="text-base font-semibold">
                              {order?.shipping?.carrier || "—"}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-muted-foreground">
                              Tracking Number
                            </p>
                            <p className="text-base font-semibold">
                              {order?.shipping?.trackingNumber || "—"}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-muted-foreground">
                              Tracking Link
                            </p>
                            <a
                              href={order.shipping.trackingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-base font-semibold text-success hover:underline"
                            >
                              <ExternalLink className="size-4" />
                              {status === "delivered"
                                ? "View delivery details"
                                : "Track your shipment"}
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Tracking information will appear once your order
                          ships.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Receipt Sidebar */}
        <div className="lg:col-span-4 sticky top-24 self-start z-10">
          <Card className="pt-0">
            <CardHeader
              className={`${
                status === "cancelled" ? "bg-destructive" : "bg-success"
              } text-background rounded-t-lg p-5`}
            >
              <CardTitle className="text-2xl font-bold">
                {status === "cancelled" ? "Cancelled Order" : "Payment Receipt"}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Subtotal</span>
                  <span className="font-bold">
                    {formatCurrency(order?.payment?.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Shipping Fee</span>
                  <span className="font-bold">
                    {formatCurrency(order?.payment?.shippingFee)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Sales Tax (Included)</span>
                  <span className="font-bold">
                    {formatCurrency(order?.payment?.taxAmount)}
                  </span>
                </div>
              </div>

              {status === "cancelled" && (
                <div className="pt-5 mt-5 border-t border-dashed space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Cancelled On</span>
                    <span className="font-bold">
                      {order?.cancellation?.cancelledAt
                        ? formatDate(order.cancellation.cancelledAt)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Reason</span>
                    <span className="font-bold">
                      {order?.cancellation?.reason || "—"}
                    </span>
                  </div>
                  {order?.cancellation?.cancelledByRole === "admin" &&
                    order?.cancellation?.notes && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Notes</span>
                        <span className="font-bold">
                          {order.cancellation.notes}
                        </span>
                      </div>
                    )}
                  {order?.cancellation?.cancelledByRole === "admin" && (
                    <p className="text-sm text-destructive font-semibold">
                      This order was cancelled by our support team.
                    </p>
                  )}
                  {order?.refund?.status === "pending" && (
                    <div className="text-sm">
                      <span className="font-semibold">Refund in Progress</span>{" "}
                      - Your bank may take 5–10 business days to post the
                      credit.
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 pt-5 border-t border-dashed flex justify-between items-center">
                <span className="font-bold text-lg">
                  {status === "cancelled" ? "Refund Amount" : "Total Paid"}
                </span>
                <span
                  className={`font-extrabold text-4xl tracking-tighter ${
                    status === "cancelled"
                      ? "text-destructive"
                      : "text-success dark:text-accent"
                  }`}
                >
                  {formatCurrency(
                    status === "cancelled"
                      ? order?.refund?.amount || order?.payment?.totalAmount
                      : order?.payment?.totalAmount,
                  )}
                </span>
              </div>

              {status !== "cancelled" && (
                <div className="space-y-2 pt-5">
                  {order?.payment?.invoiceUrl && (
                    <Button variant="outline" className="w-full h-14" asChild>
                      <a
                        href={order.payment.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="size-5" />
                        Download Invoice
                      </a>
                    </Button>
                  )}

                  {canCancel && (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => onCancelModalChange(true)}
                    >
                      Cancel Order
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel Order Modal */}
      <CancelOrderModal
        open={cancelModalOpen}
        onOpenChange={onCancelModalChange}
        reason={cancelReason}
        notes={cancelNotes}
        onReasonChange={setCancelReason}
        onNotesChange={setCancelNotes}
        onConfirm={handleCancelOrder}
        isValid={isCancelValid}
        isLoading={isCancelling}
        cancellationReasons={cancellationReasons}
      />
    </div>
  );
};

export default CheckoutSuccess;
