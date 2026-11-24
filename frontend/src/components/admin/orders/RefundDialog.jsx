import React from "react";
import { Input } from "@/components/ui/input";
import AddUpdateItemDialog from "@/components/table/AddUpdateItemDialog";
import { AdminFormTextarea } from "@/components/shared/AdminFormInput";
import { useCreateOrderRefundMutation } from "@/redux/api/adminApi";
import { handleApiError, handleApiSuccess } from "@/utils/apiHelpers";
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

const clampQty = (value, max) => {
  if (value === "") return "";
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
};

const round2 = (n) => Math.round(n * 100) / 100;

const RefundDialog = ({ open, onOpenChange, order, onSaved }) => {
  const [createOrderRefund, { isLoading }] = useCreateOrderRefundMutation();
  const lines = React.useMemo(() => getOrderLines(order), [order]);
  const refunded = React.useMemo(() => refundedQuantityByKey(order), [order]);
  const waiting = React.useMemo(() => awaitingQuantityByKey(order), [order]);
  const refundable = getRefundLimit(order, getRefundedTotal(order));
  const notShipped = order?.status === "paid" || order?.status === "on_hold";

  const [qty, setQty] = React.useState({});
  const [amount, setAmount] = React.useState("");
  const [amountTouched, setAmountTouched] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [restock, setRestock] = React.useState(true);
  const [fromBackorder, setFromBackorder] = React.useState(true);

  React.useEffect(() => {
    if (!open) return;
    setQty({});
    setAmount("");
    setAmountTouched(false);
    setReason("");
    setRestock(true);
    setFromBackorder(true);
  }, [open]);

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
          ? ["Amount too high", `At most ${formatCurrency(refundable)} can still be refunded.`]
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
      open={open}
      onOpenChange={onOpenChange}
      mode="edit"
      title="Refund"
      description={order ? `Order #${orderRef(order)} · up to ${formatCurrency(refundable)} can be refunded` : undefined}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitButtonText={
        amountValid ? `Refund ${formatCurrency(amountNum)}` : "Refund"
      }
      className="sm:max-w-2xl"
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Tick the items being refunded (optional), or just enter an amount.
          The money goes back to the customer's card through{" "}
          {order?.payment?.gateway === "square" ? "Square" : "Stripe"} and the
          customer is emailed. This can't be undone.
        </p>

        <div className="rounded-lg border divide-y max-h-[40vh] overflow-y-auto">
          {lines.map((line) => {
            // Units that already shipped (box unticked): not the backordered ones.
            const max = Math.max(
              0,
              line.quantity - (refunded[line.key] || 0) - (fromBackorder ? 0 : waiting[line.key] || 0),
            );
            return (
              <div
                key={line.key}
                className={`flex items-center justify-between gap-3 p-3 ${Number(qty[line.key]) > 0 ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}
              >
                <div className="min-w-0 text-xs">
                  <p className="font-semibold">{line.name}</p>
                  <p className="text-muted-foreground">
                    {[
                      line.group,
                      line.unitPrice != null && `${formatCurrency(line.unitPrice)} each`,
                      refunded[line.key] && `${refunded[line.key]} already refunded`,
                      waiting[line.key] && `${waiting[line.key]} backordered`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={max}
                    step={1}
                    value={qty[line.key] ?? 0}
                    aria-label={`Refund ${line.name}`}
                    onChange={(e) =>
                      setQty((prev) => ({ ...prev, [line.key]: clampQty(e.target.value, max) }))
                    }
                    disabled={isLoading || max === 0}
                    className="w-20 h-8 text-right"
                  />
                  <span className="text-xs text-muted-foreground w-10">of {max}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-1">
          <label htmlFor="refundAmount" className="text-sm font-medium">
            Amount to refund ($)
          </label>
          <Input
            id="refundAmount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmountTouched(true);
              setAmount(e.target.value);
            }}
            disabled={isLoading}
            className="w-40"
          />
          <p className="text-xs text-muted-foreground">
            {picked.length
              ? `Filled in from the prices paid${someUnpriced ? " (some items have no price of their own; add them)" : ""}, before any discount, tax or shipping. Change it if needed.`
              : "Enter any amount, e.g. part of the shipping or a damaged piece."}
          </p>
          {tooMuch && (
            <p className="text-xs text-destructive">
              At most {formatCurrency(refundable)} can still be refunded.
            </p>
          )}
          {wholeBeforeShipping && (
            <p className="text-xs text-destructive">
              That's the whole order before it ships. Cancel the order instead:
              that refunds it and puts everything back in stock.
            </p>
          )}
        </div>

        <AdminFormTextarea
          label="Reason (the customer sees this)"
          name="refundReason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Out of stock, supplier can't get it"
          disabled={isLoading}
          required
        />

        {pickedBackordered && (
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={fromBackorder}
              onChange={(e) => setFromBackorder(e.target.checked)}
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
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={restock}
              onChange={(e) => setRestock(e.target.checked)}
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
