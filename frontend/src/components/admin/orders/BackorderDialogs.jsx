import React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// A whole number from 0 to max, or "" while the box is being typed in.
const clampQty = (value, max) => {
  if (value === "") return "";
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
};

const QtyBox = ({ value, max, onChange, disabled, label }) => (
  <div className="flex items-center gap-1 shrink-0">
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      step={1}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(clampQty(e.target.value, max))}
      disabled={disabled}
      className="w-20 h-8 text-right"
    />
    <span className="text-xs text-muted-foreground w-10">of {max}</span>
  </div>
);

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
        <p className="text-xs text-muted-foreground">
          Enter how many of each item are out of stock. Those ship later as{" "}
          <span className="font-semibold">Shipment 2</span>; everything else
          ships now as usual. Leave 0 for items that are here.
        </p>
        <LineSearch
          value={query}
          onChange={setQuery}
          shown={shownLines.length}
          total={lines.length}
        />
        <div className="rounded-lg border divide-y max-h-[50vh] overflow-y-auto">
          {shownLines.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">
              No items match "{query}".
            </p>
          )}
          {shownLines.map((line) => (
            <div
              key={line.key}
              className={`flex items-center justify-between gap-3 p-3 ${Number(qty[line.key]) > 0 ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}
            >
              <div className="min-w-0 text-xs">
                <p className="font-semibold">{line.name}</p>
                {(line.group || line.bin) && (
                  <p className="text-muted-foreground">
                    {[line.group, line.bin && `Bin ${line.bin}`].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <QtyBox
                  value={qty[line.key] ?? 0}
                  max={line.quantity}
                  label={`Backordered ${line.name}`}
                  disabled={isLoading}
                  onChange={(v) => setQty((prev) => ({ ...prev, [line.key]: v }))}
                />
                {/* Backorder every unit of this line in one click. */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-3"
                  title={`Backorder all ${line.quantity}`}
                  disabled={isLoading || Number(qty[line.key]) === line.quantity}
                  onClick={() =>
                    setQty((prev) => ({ ...prev, [line.key]: line.quantity }))
                  }
                >
                  All
                </Button>
              </div>
            </div>
          ))}
        </div>
        {query && held.some((l) => !lineMatches(l, query)) && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {held.filter((l) => !lineMatches(l, query)).length} backordered
            item(s) are hidden by the search and still count.
          </p>
        )}
        <AdminFormTextarea
          label="Note (staff only)"
          name="backorderNote"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. waiting on supplier, expected next week"
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          The customer sees these items as "Awaiting shipment" on their order
          page, and the shipping email for the rest of the order lists them as
          following separately.
        </p>
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
  const shownWaiting = waiting.filter((b) => lineMatches(b, query));

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
        {waiting.length > 3 && (
          <LineSearch
            value={query}
            onChange={setQuery}
            shown={shownWaiting.length}
            total={waiting.length}
          />
        )}
        <div className="rounded-lg border divide-y max-h-[40vh] overflow-y-auto">
          {shownWaiting.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">
              No items match "{query}".
            </p>
          )}
          {shownWaiting.map((b) => (
            <div key={b.lineKey} className="flex items-center justify-between gap-3 p-3">
              <span className="text-xs font-semibold min-w-0">{b.name}</span>
              <QtyBox
                value={qty[b.lineKey] ?? b.quantity}
                max={b.quantity}
                label={`Shipping now ${b.name}`}
                disabled={isLoading}
                onChange={(v) => setQty((prev) => ({ ...prev, [b.lineKey]: v }))}
              />
            </div>
          ))}
        </div>
        {partial && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Only some items are shipping. The rest stay backordered as Shipment{" "}
            {generation + 1}.
          </p>
        )}
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
