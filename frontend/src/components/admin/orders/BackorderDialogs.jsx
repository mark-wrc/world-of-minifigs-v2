import React from "react";
import { Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddUpdateItemDialog from "@/components/table/AddUpdateItemDialog";
import ViewAdminDialog from "@/components/table/ViewAdminDialog";
import {
  AdminFormInput,
  AdminFormTextarea,
} from "@/components/shared/AdminFormInput";
import {
  useSetOrderBackorderMutation,
  useShipOrderBackorderMutation,
  useGetBackorderReportQuery,
} from "@/redux/api/adminApi";
import { handleApiError, handleApiSuccess } from "@/utils/apiHelpers";
import LineSearch from "@/components/admin/orders/LineSearch";
import { lineMatches } from "@/components/admin/orders/lineMatches";
import OrderLineList from "@/components/admin/orders/OrderLineList";
import { formatDate } from "@/utils/formatting";
import { getInvoiceNumber } from "@/constant/orderData";
import {
  getOrderLines,
  getAwaitingBackorders,
  awaitingQuantityByKey,
  refundedQuantityByKey,
} from "@shared/orderLines";

// Backorders in Order Management:
//   BackorderDialog       — before the order ships: how many of each line are
//                           out of stock and will ship later (Shipment 2).
//   ShipBackorderDialog   — after the order shipped: the held items arrived;
//                           enter tracking (and, if only some arrived, how many).
//   BackorderReportDialog — everything still waiting, by order or by item.

const orderRef = (order) =>
  getInvoiceNumber(order) || order?._id?.substring(0, 7) || "";

//------------------------------------------------ Backorder items ------------------------------------------

export const BackorderDialog = ({ open, onOpenChange, order, onSaved }) => {
  const [setOrderBackorder, { isLoading }] = useSetOrderBackorderMutation();
  // Units already refunded can't be held.
  const refunded = React.useMemo(() => refundedQuantityByKey(order), [order]);
  const lines = React.useMemo(
    () =>
      getOrderLines(order)
        .map((l) => ({ ...l, quantity: l.quantity - (refunded[l.key] || 0) }))
        .filter((l) => l.quantity > 0),
    [order, refunded],
  );
  const [qty, setQty] = React.useState({});
  const [note, setNote] = React.useState("");
  const [query, setQuery] = React.useState("");

  // Start from what is already backordered.
  React.useEffect(() => {
    if (!open || !order) return;
    setQty(awaitingQuantityByKey(order));
    setNote(getAwaitingBackorders(order)[0]?.note || "");
    setQuery("");
  }, [open, order]);

  const held = lines.filter((l) => Number(qty[l.key]) > 0);
  const shownLines = lines.filter((l) => lineMatches(l, query));

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    try {
      const result = await setOrderBackorder({
        id: order._id,
        lines: held.map((l) => ({ lineKey: l.key, quantity: Number(qty[l.key]) })),
        note: note.trim(),
      }).unwrap();
      handleApiSuccess(result, "Backorder saved");
      onSaved?.(order._id, result.order?.backorders);
      onOpenChange(false);
    } catch (error) {
      handleApiError(error, "Failed to save backorder");
    }
  };

  return (
    <AddUpdateItemDialog
      pinTitleAndButtons
      open={open}
      onOpenChange={onOpenChange}
      mode="edit"
      title="Backorder Items"
      description={order ? `Order #${orderRef(order)}` : undefined}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitButtonText={held.length ? "Save Backorder" : "Clear Backorder"}
      className="sm:max-w-2xl"
    >
      <div className="space-y-4">
        {/* What a backorder is for, so it isn't mistaken for a refund. */}
        <div className="flex items-start gap-2 rounded-md border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-800 dark:text-blue-300">
          <Info className="size-4 shrink-0 mt-px" />
          <p>
            Out of stock? Hold those items here. The rest
            ships now, and these ship later in a second package. If an item
            isn't coming, use <span className="font-semibold">Refund</span>{" "}
            instead.
          </p>
        </div>
        <LineSearch
          value={query}
          onChange={setQuery}
          shown={shownLines.length}
          total={lines.length}
        />
        <OrderLineList
          order={order}
          lines={shownLines}
          query={query}
          values={qty}
          onChange={(key, v) => setQty((prev) => ({ ...prev, [key]: v }))}
          disabled={isLoading}
        />

        {/* What ships now and what waits, over the whole order. Shown only
            once at least one item is held back. */}
        {(() => {
          const total = lines.reduce((n, l) => n + l.quantity, 0);
          const later = held.reduce((n, l) => n + Number(qty[l.key]), 0);
          if (later === 0) return null;
          return (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border p-2">
                <p className="text-muted-foreground">Ships now (Shipment 1)</p>
                <p className="font-semibold text-sm">{total - later} units</p>
              </div>
              <div
                className={`rounded-md border p-2 ${later > 0 ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : ""}`}
              >
                <p className="text-muted-foreground">Ships later (Shipment 2)</p>
                <p className="font-semibold text-sm">
                  {later} units
                  {later > 0 &&
                    ` · ${held.length} item${held.length === 1 ? "" : "s"}`}
                </p>
              </div>
              {total > 0 && later >= total && (
                <p className="col-span-2 text-destructive">
                  Every unit is held back, so nothing would ship now. Cancel
                  the order instead, or leave at least one unit to ship.
                </p>
              )}
            </div>
          );
        })()}
        {query && held.some((l) => !lineMatches(l, query)) && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {held.filter((l) => !lineMatches(l, query)).length} backordered
            item(s) are hidden by the search and still count.
          </p>
        )}
        <div className="space-y-1.5">
          <AdminFormTextarea
            label="Staff Note (optional)"
            name="backorderNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. waiting on supplier, expected next week"
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold">Only admins can see this note.</span>{" "}
            The customer only sees these items as "Awaiting shipment" on their
            order page and under "Shipping Separately" in their shipping email.
          </p>
        </div>
      </div>
    </AddUpdateItemDialog>
  );
};

//------------------------------------------------ Ship backorder ------------------------------------------

export const ShipBackorderDialog = ({ open, onOpenChange, order, onSaved }) => {
  const [shipOrderBackorder, { isLoading }] = useShipOrderBackorderMutation();
  const waiting = React.useMemo(() => getAwaitingBackorders(order), [order]);
  const generation = waiting.length
    ? Math.min(...waiting.map((b) => b.generation))
    : 2;
  const [carrier, setCarrier] = React.useState("");
  const [trackingNumber, setTrackingNumber] = React.useState("");
  const [trackingLink, setTrackingLink] = React.useState("");
  const [qty, setQty] = React.useState({});
  const [query, setQuery] = React.useState("");
  // The waiting items as order lines (for images, sections, bin and colour),
  // each with how many are still waiting as its quantity.
  const lines = React.useMemo(() => {
    const byKey = new Map(getOrderLines(order).map((l) => [l.key, l]));
    return waiting.map((b) => ({
      ...(byKey.get(b.lineKey) || { key: b.lineKey, name: b.name }),
      quantity: b.quantity,
    }));
  }, [order, waiting]);
  const shownLines = lines.filter((l) => lineMatches(l, query));

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setCarrier("");
    setTrackingNumber("");
    setTrackingLink("");
    setQty(Object.fromEntries(waiting.map((b) => [b.lineKey, b.quantity])));
  }, [open, waiting]);

  const partial = waiting.some((b) => Number(qty[b.lineKey]) !== b.quantity);

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    try {
      const result = await shipOrderBackorder({
        id: order._id,
        carrier: carrier.trim(),
        trackingNumber: trackingNumber.trim(),
        trackingLink: trackingLink.trim(),
        ...(partial && {
          lines: waiting.map((b) => ({
            lineKey: b.lineKey,
            quantity: Number(qty[b.lineKey]) || 0,
          })),
        }),
      }).unwrap();
      handleApiSuccess(result, "Backordered items shipped");
      onSaved?.(order._id, result.order?.backorders);
      onOpenChange(false);
    } catch (error) {
      handleApiError(error, "Failed to ship backordered items");
    }
  };

  return (
    <AddUpdateItemDialog
      pinTitleAndButtons
      open={open}
      onOpenChange={onOpenChange}
      mode="edit"
      title={`Ship Backordered Items (Shipment ${generation})`}
      description={order ? `Order #${orderRef(order)}` : undefined}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitButtonText="Mark as Shipped"
      className="sm:max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-800 dark:text-blue-300">
          <Info className="size-4 shrink-0 mt-px" />
          <p>
            Items arrived? Set how many are in this package, then add the
            tracking. Anything left stays backordered for the next package.
          </p>
        </div>
        {waiting.length > 3 && (
          <LineSearch
            value={query}
            onChange={setQuery}
            shown={shownLines.length}
            total={lines.length}
          />
        )}
        {/* The list and its notes sit close together. */}
        <div className="space-y-1.5">
          <OrderLineList
            order={order}
            lines={shownLines}
            query={query}
            values={qty}
            onChange={(key, v) => setQty((prev) => ({ ...prev, [key]: v }))}
            disabled={isLoading}
            className="max-h-[40vh]"
          />
          {query && lines.some((l) => !lineMatches(l, query)) && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {lines.filter((l) => !lineMatches(l, query)).length} item(s) are
              hidden by the search and still count.
            </p>
          )}
          {partial && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Only some items are shipping. The rest stay backordered as
              Shipment {generation + 1}.
            </p>
          )}
        </div>
        <AdminFormInput
          label="Carrier"
          name="backorderCarrier"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          placeholder="USPS, UPS, FedEx..."
          disabled={isLoading}
          required
        />
        <AdminFormInput
          label="Tracking Number"
          name="backorderTrackingNumber"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="1Z999AA10123456784"
          disabled={isLoading}
          required
        />
        <div className="space-y-1.5">
          <AdminFormInput
            label="Tracking Link"
            name="backorderTrackingLink"
            value={trackingLink}
            onChange={(e) => setTrackingLink(e.target.value)}
            placeholder="https://tracking.example.com/..."
            disabled={isLoading}
            required
          />
          <p className="text-xs text-muted-foreground">
            The customer gets a shipping email with this tracking, and it shows
            on their order page.
          </p>
        </div>
      </div>
    </AddUpdateItemDialog>
  );
};

//------------------------------------------------ Backorder report ------------------------------------------

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

const downloadCsv = (lines) => {
  const head = ["Invoice", "Customer", "Email", "Order type", "Order status", "Ordered", "Item", "Qty waiting", "Shipment", "Backordered on", "Note"];
  const rows = lines.map((l) => [
    l.invoice, l.customer, l.email, l.orderType, l.orderStatus,
    formatDate(l.orderedAt), l.name, l.quantity, l.shipment, formatDate(l.backorderedAt), l.note,
  ]);
  const csv = [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `backorders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const BackorderReportDialog = ({ open, onOpenChange, onOpenOrder }) => {
  const { data, isFetching } = useGetBackorderReportQuery(undefined, {
    skip: !open,
    refetchOnMountOrArgChange: true,
  });
  const [view, setView] = React.useState("orders");
  const lines = data?.lines || [];
  const byItem = data?.byItem || [];

  return (
    <ViewAdminDialog
      pinTitleAndButtons
      open={open}
      onOpenChange={onOpenChange}
      title="Backorder Report"
      className="sm:max-w-3xl"
      footerActions={
        <Button onClick={() => downloadCsv(lines)} disabled={!lines.length}>
          <Download className="size-4" />
          Download CSV
        </Button>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {isFetching
            ? "Loading…"
            : `${lines.length} item${lines.length === 1 ? "" : "s"} waiting on ${data?.orders || 0} order${data?.orders === 1 ? "" : "s"}, oldest first.`}
        </p>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={view === "orders" ? "default" : "outline"}
            onClick={() => setView("orders")}
          >
            By order
          </Button>
          <Button
            size="sm"
            variant={view === "items" ? "default" : "outline"}
            onClick={() => setView("items")}
          >
            By item
          </Button>
        </div>
      </div>

      {view === "orders" ? (
        <div className="rounded-lg border divide-y max-h-[60vh] overflow-y-auto text-xs">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 p-3">
              <div className="min-w-0">
                <p className="font-semibold">{l.name}</p>
                <p className="text-muted-foreground">
                  {onOpenOrder ? (
                    <button
                      type="button"
                      className="text-primary underline underline-offset-2 cursor-pointer"
                      onClick={() => onOpenOrder(l.orderId)}
                    >
                      #{l.invoice}
                    </button>
                  ) : (
                    `#${l.invoice}`
                  )}{" "}
                  · {l.customer || l.email} · ordered {formatDate(l.orderedAt)}
                  {l.orderStatus === "shipped" ? " · rest shipped" : ""}
                </p>
                {l.note && <p className="text-muted-foreground">Note: {l.note}</p>}
              </div>
              <span className="font-bold whitespace-nowrap">× {l.quantity}</span>
            </div>
          ))}
          {!isFetching && !lines.length && (
            <p className="p-3 text-muted-foreground">Nothing is backordered.</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border divide-y max-h-[60vh] overflow-y-auto text-xs">
          {byItem.map((item, i) => (
            <div key={i} className="flex justify-between gap-3 p-3">
              <span className="font-semibold">{item.name}</span>
              <span className="whitespace-nowrap">
                <span className="font-bold">× {item.quantity}</span>{" "}
                <span className="text-muted-foreground">
                  ({item.orders} order{item.orders === 1 ? "" : "s"})
                </span>
              </span>
            </div>
          ))}
          {!isFetching && !byItem.length && (
            <p className="p-3 text-muted-foreground">Nothing is backordered.</p>
          )}
        </div>
      )}
    </ViewAdminDialog>
  );
};
