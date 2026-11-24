# Backorders and refunds

Two additions to **Order Management**, both on pull request #12 (branch `backorders`):

Section 3 lists screen changes added later at Brendyn's request.

1. **Backorders**: when some items of a paid order are out of stock, staff hold
   just those back. The rest ships as usual; the held items ship later in their
   own package(s) with their own tracking.
2. **Refunds without cancelling**: staff refund some items and/or an amount of
   a paid order, back to the card through the gateway that took the payment
   (Stripe or Square).

Nothing in checkout, payment, the Odoo integration API or the existing cancel
flow changes for orders that don't use these features. There are no new
environment variables and no data migration: the new fields are empty
(undefined) on every existing order.

---

## 1. Backorders

### How staff use it

- **Order details** (order is Paid or Held): **Backorder Items (out of stock)**.
  Enter how many of each item are missing (part of a line is fine: 10 ordered,
  4 held). Optional staff-only note. Every item at once is refused, since then
  nothing would ship.
- Mark the order **Shipped** as normal. That is **Shipment 1**.
- When the held items arrive: **Ship Backordered Items**, then enter carrier,
  tracking number and link, plus an optional quantity per item. If only some
  arrived, the rest move to the next shipment (Shipment 3, 4, …).
- **Order list**: an amber "Backorder · N items waiting" tag. The status filter
  **Backordered (items waiting)** lists them, oldest first.
- **Backorder Report** button: everything still waiting, by order or by item,
  with a CSV download.
- **Order PDF**: a "Shipping Separately (Backordered)" table.

### What the customer sees

- Order page: an "Items Shipping Separately" card, with each later shipment's
  status and tracking link.
- My Orders card: "Some items are awaiting shipment".
- **Emails:**
  - The normal "Your order has shipped" email for Shipment 1 now lists the held
    items under "Shipping Separately".
  - Each later shipment sends a new "The Rest of Your Order Has Shipped" email
    with that package's tracking and items, and anything still to come.
  - Holding items back sends no email.

### Data

`order.backorders[]`: `{ lineKey, name, quantity, generation (2, 3, …),
status: awaiting|shipped, note, createdAt, createdById, shipping{carrier,
trackingNumber, trackingLink, shippedAt}, shippedById }`.

`lineKey` points at the order line. The keys are built in
`shared/orderLines.js`, which both the backend and the frontend use:

| Key | Order line |
|---|---|
| `p<i>` | `productItems[i]` |
| `b<i>t<j>` | `dealerItems.bundles[i].torsoBags[j]` |
| `b<i>` | a bundle with no torso bags |
| `t<j>` | legacy `dealerItems.torsoBags[j]` |
| `a<i>s<j>` | `dealerItems.addons[i].subItems[j]` |
| `a<i>` | an add-on with no sub-items |
| `x<i>` | `dealerItems.extraBags[i]` |

The order's own `status` is unchanged: "shipped" means Shipment 1 went out.

### Routes (admin, `backend/controllers/backorderController.js`)

| Route | What it does |
|---|---|
| `PUT /api/v1/admin/orders/:id/backorder` `{ lines:[{lineKey,quantity}], note }` | Sets the held quantities. Paid/Held only. |
| `POST /api/v1/admin/orders/:id/backorder/ship` `{ carrier, trackingNumber, trackingLink, lines? }` | Ships held items. Shipped/Delivered only. |
| `GET /api/v1/admin/orders/backorders` | The report. Registered before `/orders/:id`. |
| `GET /api/v1/admin/orders?status=backordered` | The list filter. |

---

## 2. Refunds without cancelling

### How staff use it

Order details (Paid, Held, Shipped or Delivered): **Refund Items or an
Amount** (or **Refund** once there is one). The form has:

- **Items and quantities.** Optional. The amount fills in from the prices
  paid, before any discount, tax or shipping. Staff can change it.
- **Amount.** It can't be more than what's left of the payment.
- **Reason.** Required, and the customer sees it.
- **Put these items back in stock now.** Ticked by default. If unticked, the
  refund shows a **Put back in stock** button for later, which works once.

Rules:

- Several refunds per order are fine.
- Refunding **everything before the order ships** is refused with "cancel the
  order instead". Cancel also handles stock and consolidated shipments.
- Refunded items that were **backordered** come off the backorder by default,
  because they aren't coming. They are **never** put back in stock, because
  they never came in. If the refund is for units that already shipped (for
  example damaged ones), staff untick "These are the backordered items" and the
  backorder is left alone.
- On an order that paid a **group shipment's** fee, refunds are capped so the
  fee stays while other orders in the parcel still need it. This is the same
  rule cancelling uses.
- Units already refunded can't be backordered.
- The customer gets an "A Refund Has Been Issued" email and sees a Refunds card
  on their order page. My Orders shows "$X refunded".
- The order list shows a red "Refunded $X" tag. The order view shows a Refunds
  section and "Refunded so far" in the payment summary. The dashboard
  "Refunds" figure includes these refunds.

### How a refund is made (`backend/controllers/refundController.js`)

1. **Lock.** One refund at a time per order: `refundLockUntil` is set
   atomically and expires after 2 minutes. An order whose cancellation is
   locked is refused.
2. **Checks.** Valid items and quantities, an amount in whole cents, and never
   more than what a cancel could refund (`getCancellationRefundAmount` or the
   total) minus refunds so far. Failed refunds don't count.
3. **Pending first.** The refund is saved as **pending** before any money
   moves.
4. **Gateway call.** `gateway.createRefund(order, { amount, idempotencyKey:
   "rf_<refund id>", reason })`.
   - Each refund has its own idempotency key, so a second refund on the same
     order isn't mistaken for a retry of the first.
   - The key is under Square's 45-character limit.
   - The cancel refund keeps its old key, `refund_<order id>`.
5. **Save the result.** The gateway's answer (id, completed or pending) is
   saved on its own, before anything else. A later failure can't lose a refund
   that went through.
   - If the gateway refuses, the refund is kept as **failed** with the error
     (staff only). No money moved, and nothing is used up.
6. **Backorder and stock.** Then the backorder is updated and the stock put
   back (or held), and the email is sent.

`POST /api/v1/admin/orders/:id/refunds/:refundId/restock` puts held items back.
It flips "held" to "done" atomically first, so it can never add stock twice.

### Data

`order.refunds[]`: `{ amount, reason, lines:[{lineKey, name, quantity,
fromBackorder, restockQuantity}], status: pending|completed|failed,
source: admin|gateway, gatewayRefundId, error, restock: done|held|none,
restockedAt, restockedById, createdAt, createdById, completedAt }`.

The refund made when an order is **cancelled** stays in `order.refund`,
unchanged.

### Changes to existing code (please check these)

- **Gateways** (`stripeGateway.js`, `squareGateway.js`): `createRefund` takes
  optional `idempotencyKey` and `reason` (Square). Without them, the call is
  exactly as before.
- **Cancelling** (`orderService.js`):
  - `acquireCancellationLock` is now one atomic `findOneAndUpdate`, with the
    same rule as before (the lock must be free or expired). It also requires
    the order to still be Paid or Held, so two cancels at once can't both go
    through, and it refuses while a refund is being made (`refundLockUntil`).
    A refund likewise refuses while a cancel holds the lock, so the two can
    never run at once.
  - `createRefundForOrder` re-reads the order's refunds. A refund still pending
    at the provider is synced first. If it is still pending, the cancel stops
    with a clear message (`orderController` shows `err.description`). That way
    a pending refund that later fails can't leave the customer short.
    Otherwise it refunds only what's left (an explicit amount, which Square
    needs). Orders without refunds take the exact old path.
  - A refund saved as pending but never given the provider's id (the server
    stopped mid-refund, or the provider call timed out) is looked up once its
    2-minute lock has expired. The gateways have a new `listRefunds`: Stripe
    `refunds.list`, Square `payments.get` then `refundIds`. If the provider has
    it, it's matched by amount, counted, and flagged for staff to check stock.
    If not, it's marked failed, because no money moved. So it can't block a
    cancel forever.
  - `restockOrderItemsSafely` skips units already refunded and units still on
    backorder, which never came in. Orders with neither take the exact old
    path (`restockOrder`).
  - `shipmentService.releaseShipmentIfEmpty`: "fee already refunded" now also
    counts refunds made before the cancel, so the shipping fee isn't refunded
    twice.
- **Ship Backordered Items** saves with a conditional update: every entry it
  read must still be waiting and unchanged. So a double click, or two people at
  once, can't ship the same items twice. The second one gets "Already changed".
  It also waits while a refund is running, and it bumps `__v`, so an older
  copy of the order can't be saved over it.
- **Refunding units that already shipped** (backorder box unticked) is capped
  at ordered − refunded − still on backorder.
- **Add-on bags:** an add-on sub-item line counts bags per add-on × add-ons
  ordered, which is what checkout took from stock. This applies to backorders,
  refunds and restocking.
- **Refund webhooks** (`refundHandler.js`, `handleRefundUpdated`):
  - Refunds in `order.refunds` are matched by id first, and a failed one is
    marked failed.
  - Cancelled orders, and orders being cancelled, go through the existing code
    exactly as before.
  - **Behaviour change:** a refund made directly in the Stripe/Square
    dashboard on an order that is **not** cancelled is now listed in
    `order.refunds` (source "gateway"). Before, it was written into
    `order.refund` as if it were the cancel refund.
  - Stripe sends `refund.updated` (the only Stripe refund event handled, as
    before) only when a refund's status changes. So a dashboard refund that
    succeeds instantly may not reach the site at all. That's the same as
    today; adding `refund.created` would be a separate change.
- **Pending refunds** are re-checked with the gateway when an order is opened.
  This is the same as the existing sync for the cancel refund, and only
  happens when one is pending.
- **Customer endpoints** also hide `refunds.createdById`,
  `refunds.restockedById`, `refunds.error` and `refundLockUntil`, as well as
  the backorder staff fields.
- **The Odoo integration key** is blocked from every admin `/orders` route
  (existing rule), so Odoo can never start a refund or change a backorder.

---

## 3. Screen changes added after the first review request

Brendyn asked for these after trying the screens. **Frontend only**: no backend,
data, email or payment changes.

1. **Backorder shipments are their own lines in the order list.** Every later
   shipment of an order (Shipment 2, 3, …) shows as a line right under the
   order: amber "Awaiting shipment" or blue "Shipped" with carrier and
   tracking, the number of items, and what those items cost. They're shown by
   default. The arrow next to the order's invoice number hides or shows them.
   Inside a consolidated parcel, an order's shipment lines show under that
   order.
2. **The order's ⋯ menu has backorder actions:**
   - "Backorder Items", or "Change Backorder" if items are already held. Shown
     while the order is Paid or Held.
   - "Ship Backordered Items". Shown once the order has shipped and something
     is still waiting.
3. **Each shipment line has its own ⋯ menu,** like a normal order:
   - "View shipment" shows its items, tracking and note, plus the customer and
     ship-to.
   - "Mark as shipped" opens the existing Ship Backordered Items window.
   - "Backorder Items" (while the order is Paid or Held).
   - "View order".
   A waiting shipment can't be marked shipped before the rest of the order. The
   line says "Ships after the rest of the order", the same rule the backend
   already enforces.
4. **Search in the Backorder Items and Refund windows.** A search box filters
   the item list by name, colour or bin. It only hides lines: quantities typed
   for hidden lines are kept. A note says so if any are hidden. Ship
   Backordered Items gets the same box when more than 3 items are waiting.
5. **Order view: the top stays put.**
   - The Order Information box is on the left, and the Customer, Billing and
     Shipping Address boxes are beside it on the right. The boxes look the
     same as before; only their position changed.
   - The order window is wider (`sm:max-w-4xl`) to fit them, and they stack
     again on narrow screens.
   - These boxes stay at the top while the rest of the order (tracking,
     items, backorders, refunds, payment) scrolls under them, with a thin line
     underneath. In windows under 700px tall they scroll normally.
   - The "Order Details" title and the close button stay put too.
     `ViewAdminDialog` takes an optional `fixedTitle` prop for this. It's off
     by default, so every other dialog is unchanged.
6. **The copy button copies the name and the address.** It copies a
   label-ready block: recipient name, street, unit, "City, ST ZIP", country.
   Before, it copied the address only. It works the same in the consolidated
   shipment view.

Files: `pages/admin/OrderManagement.jsx`,
`components/admin/orders/BackorderDialogs.jsx`,
`components/admin/orders/RefundDialog.jsx`,
`components/admin/orders/LineSearch.jsx` (new),
`components/admin/orders/lineMatches.js` (new), and
`components/table/BaseColumn.jsx`, `components/table/ViewAdminDialog.jsx`. `ActionsColumn` takes an optional
`extraActions` list. It's empty by default, so the other 35 tables that use
it are unchanged.

Checked: `vite build` passes, eslint is clean on these files, and every item
above was clicked through locally with made-up orders.

---

## Files

Backend:
- `shared/orderLines.js` (new)
- `backend/models/order.model.js`
- `backend/constants/orderConstants.js`
- `backend/controllers/backorderController.js` (new)
- `backend/controllers/refundController.js` (new)
- `backend/controllers/orderController.js`
- `backend/controllers/dashboardController.js`
- `backend/routes/adminRoutes.js`
- `backend/services/orderService.js`
- `backend/services/orderEmailService.js`
- `backend/services/payment/refundHandler.js`
- `backend/services/payment/gateways/stripeGateway.js`
- `backend/services/payment/gateways/squareGateway.js`
- `backend/utils/Email/orderEmails.js`
- `backend/utils/payment/stockManager.js`

Frontend:
- `components/admin/orders/BackorderDialogs.jsx` (new)
- `components/admin/orders/RefundDialog.jsx` (new)
- `components/shared/BackorderShipments.jsx` (new)
- `components/shared/OrderRefunds.jsx` (new)
- `pages/admin/OrderManagement.jsx`
- `pages/CheckoutSuccess.jsx`
- `hooks/usePurchase.js`
- `components/products/OrderCard.jsx`
- `redux/api/adminApi.js`
- `constant/orderData.js`
- `utils/exportOrderPdf.js`

## Tests that were run

These were run outside the repo, against the real `backend/app.js` with a
throwaway in-memory MongoDB (`mongodb-memory-server`), fake keys, and a local
mail catcher in place of a real mail server.

**Backorders: 35/35.**
- Limits.
- Partial shipping rolling into Shipment 3.
- The filter and report.
- Customers can't see staff notes or call admin routes.
- The normal "mark as shipped" is unchanged.
- Every email.

**Review fixes: 27/27** (`test-review-fixes.mjs`). A code review found 10
issues, each now fixed and tested:
- cancelling a group-shipment order after a partial refund
- a cancel and a refund at the same time
- cancelling while a refund is still processing
- duplicate webhook deliveries
- add-on bag counts
- restocking backordered items on cancel
- refunds eating into a group shipment's fee
- backordering refunded units
- refunding a unit that already shipped
- double-click shipping

Run against the code from before the fixes, 13 of these checks fail. The
duplicate-webhook and double-click races couldn't be made to happen in the
test setup, so their checks pass either way; the fixes are atomic database
updates.

**Refunds: 39/39.** Stripe and Square were swapped for fakes from outside the
app (a `node --import` hook), so nothing could reach a real payment account.
- Item and amount refunds, each with its own key.
- Backordered items come off the backorder and aren't restocked.
- All limits.
- Hold, then "Put back in stock" (once).
- A gateway refusal.
- Pending becomes completed by webhook and by opening the order.
- A pending refund's webhook is not taken as a cancellation.
- A dashboard refund is listed once.
- Two clicks at once give one refund.
- Cancel after refunds refunds only what's left ($79 of $110) and restocks only
  the rest.
- A plain cancel makes the identical Stripe call as before.
- Square: key length and reason.
- Customer visibility.
- The dashboard figure.
- One email per successful refund.

A second review pass confirmed the 10 fixes and found four smaller follow-ups (a stuck pending refund blocking cancel, the "already shipped" refund cap, Ship Backorder vs a running refund, and the refund form's limit on group-shipment orders) plus an older double-cancel race; all are fixed and covered by the 7 extra checks.

`vite build` passes. eslint is clean on the changed frontend files except one error that is already on `main` (`summarize` unused in `constant/orderData.js`). The
admin and customer screens were clicked through locally with made-up orders.

## Suggested checks before merging (on a test copy, Stripe in test mode)

1. **Plain cancel.** Place a test order, then cancel it from the admin. The
   refund and email should be exactly as today.
2. **Refund one item.** On a paid test order, refund 1 item and keep "put back
   in stock" ticked.
   - The Stripe test dashboard shows the partial refund.
   - The product's stock goes up by 1.
   - The customer email arrives.
3. **Two refunds.** Refund a second, amount-only refund on the same order.
   Stripe shows a second, separate refund.
4. **Cancel after refunds.** Cancel that order. Stripe refunds only the rest.
5. **Backorder and ship.** Backorder an item, ship the order, then ship the
   backorder with tracking. Both shipping emails arrive.

## Rolling back

Revert the merge. The new fields (`backorders`, `refunds`, `refundLockUntil`)
are optional and ignored by the old code. Refunds already made stay in Stripe
and Square as normal.
