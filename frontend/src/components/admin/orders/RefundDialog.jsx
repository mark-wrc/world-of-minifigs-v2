import React from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import OrderLineList from "@/components/admin/orders/OrderLineList";
import AddUpdateItemDialog from "@/components/table/AddUpdateItemDialog";
import { AdminFormTextarea } from "@/components/shared/AdminFormInput";
import { useCreateOrderRefundMutation } from "@/redux/api/adminApi";
import { handleApiError, handleApiSuccess } from "@/utils/apiHelpers";
import LineSearch from "@/components/admin/orders/LineSearch";
import { lineMatches } from "@/components/admin/orders/lineMatches";
import { formatCurrency } from "@/utils/formatting";
import { getInvoiceNumber, getRefundLimit } from "@/constant/orderData";
import {
  getOrderLines,
  getRefundedTotal,
  refundedQuantityByKey,
  awaitingQuantityByKey,
} from "@shared/orderLines";

// Refund part of an order without cancelling it: tick items and quantities
// (the amount fills in from the prices paid), or just type an amount. The
// amount is what is sent back to the customer's card through Stripe/Square.
// The customer is emailed. Refunded items go back in stock unless "Put back
// in stock now" is unticked; backordered ones come off the backorder instead.

const orderRef = (order) =>
  getInvoiceNumber(order) || order?._id?.substring(0, 7) || "";

const round2 = (n) => Math.round(n * 100) / 100;

// The server keeps up to 300 characters of the reason.
const REASON_MAX = 300;

// Usual reasons, written for the customer (they see it in their email).
const QUICK_REASONS = [
  "Item out of stock",
  "Item arrived damaged",
  "Item missing from package",
  "Shipping overcharge",
];

const RefundDialog = ({ open, onOpenChange, order, onSaved }) => {
  const [createOrderRefund, { isLoading }] = useCreateOrderRefundMutation();
  const lines = React.useMemo(() => getOrderLines(order), [order]);
  const refunded = React.useMemo(() => refundedQuantityByKey(order), [order]);
  const waiting = React.useMemo(() => awaitingQuantityByKey(order), [order]);
  const alreadyRefunded = getRefundedTotal(order);
  const refundable = getRefundLimit(order, alreadyRefunded);
  const notShipped = order?.status === "paid" || order?.status === "on_hold";

  const [qty, setQty] = React.useState({});
  const [amount, setAmount] = React.useState("");
  const [amountTouched, setAmountTouched] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [restock, setRestock] = React.useState(true);
  const [fromBackorder, setFromBackorder] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const shownLines = lines.filter((l) => lineMatches(l, query));

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setQty({});
    setAmount("");
    setAmountTouched(false);
    setReason("");
    setRestock(true);
    setFromBackorder(true);
  }, [open]);

  // The most of a line that can be refunded: not what's already refunded and,
  // when the refund is for units that shipped (box unticked), not the
  // backordered ones.
  const maxFor = (line) =>
    Math.max(
      0,
      line.quantity -
        (refunded[line.key] || 0) -
        (fromBackorder ? 0 : waiting[line.key] || 0),
    );

  // Unticking "These are the backordered items" lowers some limits: bring
  // any quantity above its new limit down to it.
  React.useEffect(() => {
    setQty((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const line of lines) {
        const max = Math.max(
          0,
          line.quantity -
            (refunded[line.key] || 0) -
            (fromBackorder ? 0 : waiting[line.key] || 0),
        );
        if (Number(next[line.key]) > max) {
          next[line.key] = max;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [fromBackorder, lines, refunded, waiting]);

  const picked = lines.filter((l) => Number(qty[l.key]) > 0);
  const itemsValue = round2(
    picked.reduce((sum, l) => sum + (l.unitPrice || 0) * Number(qty[l.key]), 0),
  );
  const someUnpriced = picked.some((l) => l.unitPrice == null);

  // The amount follows the ticked items until staff type their own.
  React.useEffect(() => {
    if (!amountTouched) setAmount(itemsValue ? itemsValue.toFixed(2) : "");
  }, [itemsValue, amountTouched]);

  const amountNum = Number(amount);
  const amountValid =
    amount !== "" && amountNum > 0 && Math.abs(amountNum * 100 - Math.round(amountNum * 100)) < 1e-6;
  const tooMuch = amountValid && amountNum > refundable + 0.0001;
  const wholeBeforeShipping =
    amountValid && notShipped && amountNum >= refundable - 0.0001;
  const pickedBackordered = picked.some((l) => waiting[l.key] > 0);
  const canSubmit = amountValid && !tooMuch && !wholeBeforeShipping && reason.trim();

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    if (!canSubmit) {
      const why = !amountValid
        ? ["Enter an amount", "Enter the amount to refund, e.g. 12.50."]
        : tooMuch
          ? ["Amount too high", `You can refund up to ${formatCurrency(refundable)}.`]
          : wholeBeforeShipping
            ? ["Cancel the order instead", "That's the whole order before it ships."]
            : ["Reason is required", "Say why this is being refunded. The customer sees it."];
      handleApiError({ data: { message: why[0], description: why[1] } });
      return;
    }
    try {
      const result = await createOrderRefund({
        id: order._id,
        amount: round2(amountNum),
        reason: reason.trim(),
        lines: picked.map((l) => ({ lineKey: l.key, quantity: Number(qty[l.key]) })),
        restock,
        takeOffBackorder: fromBackorder,
      }).unwrap();
      handleApiSuccess(result, "Refunded");
      onSaved?.(order._id, result.order);
      onOpenChange(false);
    } catch (error) {
      // A refused refund is still saved (as "failed"), so show it on the order.
      if (error?.data?.order) onSaved?.(order._id, error.data.order);
      handleApiError(error, "Refund failed");
    }
  };

  return (
    <AddUpdateItemDialog
      pinTitleAndButtons
      open={open}
      onOpenChange={onOpenChange}
      mode="edit"
      title="Refund"
      description={order ? `Order #${orderRef(order)}` : undefined}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      // An amount over the limit (or the whole order before it ships) can't
      // be refunded, so the button is off until it's fixed.
      submitDisabled={tooMuch || wholeBeforeShipping}
      submitButtonText={
        amountValid && !tooMuch && !wholeBeforeShipping
          ? `Refund ${formatCurrency(amountNum)}`
          : "Refund"
      }
      className="sm:max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-800 dark:text-blue-300">
          <Info className="size-4 shrink-0 mt-px" />
          <p>
            Pick the items to refund, or just enter an amount. The money goes
            back to the customer's card through{" "}
            {order?.payment?.gateway === "square" ? "Square" : "Stripe"}, and
            they get an email.{" "}
            <span className="font-semibold">This can't be undone.</span>
          </p>
        </div>

        <LineSearch
          value={query}
          onChange={setQuery}
          shown={shownLines.length}
          total={lines.length}
          disabled={isLoading}
        />
        <OrderLineList
          order={order}
          lines={shownLines}
          query={query}
          values={qty}
          onChange={(key, v) => setQty((prev) => ({ ...prev, [key]: v }))}
          getMax={maxFor}
          getExtraMeta={(line) => [
            refunded[line.key] && `${refunded[line.key]} already refunded`,
            waiting[line.key] && `${waiting[line.key]} backordered`,
          ]}
          disabled={isLoading}
          className="max-h-[40vh]"
        />

        {query && picked.some((l) => !lineMatches(l, query)) && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {picked.filter((l) => !lineMatches(l, query)).length} ticked
            item(s) are hidden by the search and are still in this refund.
          </p>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="refundAmount">Amount to Refund</Label>
            {/* How much is left to refund (and what's already gone back) */}
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-xs">
              <span className="text-muted-foreground">Available to refund:</span>
              <span className="font-bold text-sm text-red-600 dark:text-red-500">
                {formatCurrency(refundable)}
              </span>
              {alreadyRefunded > 0 && (
                <span className="text-muted-foreground">
                  ({formatCurrency(alreadyRefunded)} refunded)
                </span>
              )}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Dollar amount with a $ in front; fills the row, with the quick
                fills at its end. */}
            <div className="relative flex-1 min-w-40">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="refundAmount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={amount}
                aria-invalid={tooMuch || wholeBeforeShipping || undefined}
                onKeyDown={(e) => {
                  if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
                }}
                onChange={(e) => {
                  setAmountTouched(true);
                  setAmount(e.target.value);
                }}
                // Tidy to cents when leaving the box (12.5 → 12.50).
                onBlur={() => {
                  if (amount !== "" && Number.isFinite(Number(amount))) {
                    setAmount(Number(amount).toFixed(2));
                  }
                }}
                disabled={isLoading}
                className="pl-7 [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            {/* Quick fills */}
            {picked.length > 0 &&
              itemsValue > 0 &&
              Number(amount) !== itemsValue && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shadow-none"
                  disabled={isLoading}
                  onClick={() => {
                    setAmountTouched(false);
                    setAmount(itemsValue.toFixed(2));
                  }}
                >
                  Items total {formatCurrency(itemsValue)}
                </Button>
              )}
            {!notShipped &&
              refundable > 0 &&
              Number(amount) !== round2(refundable) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shadow-none"
                  disabled={isLoading}
                  onClick={() => {
                    setAmountTouched(true);
                    setAmount(round2(refundable).toFixed(2));
                  }}
                >
                  {/* The number itself is in "Available to refund" above. */}
                  Full amount
                </Button>
              )}
          </div>
          {/* One line only: the problem when there is one, otherwise the hint. */}
          {tooMuch ? (
            <p className="text-xs text-destructive">
              That's more than this order has left. You can refund up to{" "}
              <span className="font-semibold">{formatCurrency(refundable)}</span>.
            </p>
          ) : wholeBeforeShipping ? (
            <p className="text-xs text-destructive">
              That's the whole order, and it hasn't shipped yet. Cancel the
              order instead. That refunds the customer and puts the items back
              in stock.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {picked.length
                ? "Based on the item prices, before discounts, tax and shipping. You can change it."
                : "Enter any amount, e.g. part of the shipping or a damaged piece."}
              {picked.length > 0 &&
                someUnpriced &&
                " Some items have no price of their own, so add their amount."}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <AdminFormTextarea
            label="Reason for Refund"
            name="refundReason"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
            placeholder="e.g., out of stock, damaged items"
            maxLength={REASON_MAX}
            rows={3}
            disabled={isLoading}
            required
          />
          {/* Quick picks for the usual reasons; staff can edit after. */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REASONS.map((text) => (
              <Button
                key={text}
                type="button"
                size="sm"
                variant={reason === text ? "accent" : "outline"}
                className="h-7 rounded-full px-3 text-xs font-normal shadow-none"
                disabled={isLoading}
                onClick={() => setReason(text)}
              >
                {text}
              </Button>
            ))}
          </div>
        </div>

        {pickedBackordered && (
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <Checkbox
              className="mt-0.5"
              checked={fromBackorder}
              onCheckedChange={(v) => setFromBackorder(v === true)}
              disabled={isLoading}
            />
            <span>
              <span className="font-semibold">These are the backordered items</span>{" "}
              (they aren't coming): take them off the backorder. Untick if the
              refund is for items that already shipped (e.g. damaged).
            </span>
          </label>
        )}

        {picked.length > 0 && (
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <Checkbox
              className="mt-0.5"
              checked={restock}
              onCheckedChange={(v) => setRestock(v === true)}
              disabled={isLoading}
            />
            <span>
              <span className="font-semibold">Put these items back in stock now.</span>{" "}
              Untick if they haven't come back yet. You can put them back later
              from the order.
              {pickedBackordered &&
                fromBackorder &&
                " Backordered items come off the backorder and are not put back in stock (they never came in)."}
            </span>
          </label>
        )}
      </div>
    </AddUpdateItemDialog>
  );
};

export default RefundDialog;
