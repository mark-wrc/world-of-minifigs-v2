import React, { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { Boxes, Download, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import ErrorState from "@/components/shared/ErrorState";
import { useConfirmShipmentQuery } from "@/redux/api/paymentApi";
import { authApi } from "@/redux/api/authApi";
import { formatCurrency } from "@/utils/formatting";
import {
  getOrderRef,
  getOrderStatusConfig,
  PAYMENT_GATEWAY_LABELS,
} from "@/constant/orderData";

// Pay Now, Ship Later — landing page after paying the flat shipping fee for
// held orders. Stripe returns `session_id`, Square `gateway=square&ref=`.
const ShipmentSuccess = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const sessionId = searchParams.get("session_id");
  const isSquareReturn = searchParams.get("gateway") === "square";
  const ref = sessionId || (isSquareReturn ? searchParams.get("ref") : null);

  const { data, isLoading, isError } = useConfirmShipmentQuery(
    { gateway: sessionId ? "stripe" : "square", ref },
    { skip: !ref },
  );
  const shipment = data?.shipment;

  useEffect(() => {
    if (!ref) navigate("/purchase", { replace: true });
  }, [ref, navigate]);

  useEffect(() => {
    if (shipment) {
      dispatch(authApi.util.invalidateTags(["UserOrder", "HeldOrders"]));
    }
  }, [shipment, dispatch]);

  if (!ref || isLoading) return <LoadingSpinner minHeight="min-h-screen" />;

  if (isError || !shipment) {
    return (
      <ErrorState
        title="Shipment Information Unavailable"
        description="We couldn't load your shipment just yet. Please refresh this page in a few moments, or check My Orders."
        minHeight="min-h-screen"
      />
    );
  }

  const orders = shipment.orders || [];
  const isCancelled = shipment.status === "cancelled";
  const payment = shipment.payment || {};

  return (
    <div className="px-5 py-10 space-y-8">
      <div className="text-center space-y-4">
        <div
          className={`size-16 mx-auto rounded-full flex items-center justify-center ring-10 ${
            isCancelled
              ? "text-destructive bg-destructive/10 ring-destructive/20"
              : "text-success bg-success/10 ring-success/20"
          }`}
        >
          {isCancelled ? (
            <XCircle className="size-8" strokeWidth={2.5} />
          ) : (
            <Boxes className="size-8" strokeWidth={2.5} />
          )}
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">
          {isCancelled
            ? "Nothing left to ship"
            : `We're packing your ${orders.length} order${orders.length === 1 ? "" : "s"}!`}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mx-auto max-w-xl">
          {isCancelled
            ? "The held orders for this shipment were cancelled before it was paid, so your shipping payment is being refunded to your original payment method."
            : "Everything ships together in one parcel. You'll get one email with the tracking number as soon as it's on its way."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8">
          <Card>
            <CardContent className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Orders in this shipment
              </p>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders.</p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {orders.map((o) => (
                    <Link
                      key={o._id}
                      to={`/checkout/success?order_id=${o._id}`}
                      className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-muted/50"
                    >
                      <span className="font-semibold">
                        #{getOrderRef(o)}
                        <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">
                          {o.orderType}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-xs font-medium">
                          {getOrderStatusConfig(o).label}
                        </span>
                        <span className="font-bold">
                          {formatCurrency(o.payment?.totalAmount)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card className="pt-0">
            <CardHeader
              className={`${isCancelled ? "bg-destructive" : "bg-success"} text-background rounded-t-lg p-5`}
            >
              <CardTitle className="text-2xl font-bold">
                Shipping Receipt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex justify-between items-center">
                <span className="text-sm">Flat Shipping</span>
                <span className="font-bold">
                  {formatCurrency(payment.shippingFee)}
                </span>
              </div>
              {payment.shippingInsurance > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm">Shipping Insurance (0.5%)</span>
                  <span className="font-bold">
                    {formatCurrency(payment.shippingInsurance)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm">Sales Tax</span>
                <span className="font-bold">
                  {formatCurrency(payment.taxAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Paid With</span>
                <span className="font-bold">
                  {PAYMENT_GATEWAY_LABELS[payment.gateway] || payment.gateway}
                </span>
              </div>
              <div className="pt-5 border-t border-dashed flex justify-between items-center">
                <span className="font-bold text-lg">
                  {isCancelled ? "Refund Amount" : "Total Paid"}
                </span>
                <span
                  className={`font-extrabold text-4xl tracking-tighter ${
                    isCancelled
                      ? "text-destructive"
                      : "text-success dark:text-accent"
                  }`}
                >
                  {formatCurrency(payment.totalAmount)}
                </span>
              </div>
              <div className="space-y-2">
                {payment.receiptUrl && (
                  <Button variant="outline" className="w-full h-14" asChild>
                    <a
                      href={payment.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="size-5" />
                      Download Receipt
                    </a>
                  </Button>
                )}
                <Button variant="dark" className="w-full h-12" asChild>
                  <Link to="/purchase">View My Orders</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ShipmentSuccess;
