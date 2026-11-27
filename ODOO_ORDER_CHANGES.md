# Odoo order changes: backorders, refunds and cancelling from Odoo

A proposal for Edmark (branch `odoo-order-changes`). Nothing here changes the
website admin, checkout, payments, or how the admin order view works.

## Why

Brick Extreme wants to run all of its sales channels from one place: Odoo.
BrickLink, worldofminifigs.com and the Minifig Club orders all come into Odoo
already, and the team picks, packs and ships from there. Today they still have
to come back to the website admin for three things: holding items back
(backorders), refunds, and cancelling. That means two places to check and two
places that can disagree. The goal is that the team never needs to log in to
each channel for day-to-day order work.

When you reviewed the first Odoo connection (#11), you asked for the key to be
kept away from the admin order screens, because cancelling there refunds the
customer. That was the right call, and this proposal keeps it: **the key still
can't reach `/api/v1/admin/orders` at all.** Instead, Odoo gets a few narrow
addresses of its own under `/api/v1/integration/orders`, one per action, each
running the code you merged in #12 unchanged. Money actions sit behind their own
off switch on the server, which you control.

## What's added

| Address (under `/api/v1/integration`) | What it does | Money? |
|---|---|---|
| `PUT /orders/:id/backorder` | Hold items back before the order ships (same as **Backorder Items**) | no |
| `POST /orders/:id/backorder/ship` | Ship held items later with their own tracking (same as **Ship Backordered Items**; the customer gets that package's shipping email) | no |
| `POST /orders/:id/refunds` | Refund some items and/or an amount without cancelling (same as **Refund**) | **yes** |
| `POST /orders/:id/refunds/:refundId/restock` | Put a refund's items back in stock later (same as **Put back in stock**) | no |
| `POST /orders/:id/cancel` | Cancel: refunds what's left and restocks (same as **Cancel**) | **yes** |

Each one calls the existing controller (`setOrderBackorder`, `shipOrderBackorder`,
`createOrderRefund`, `restockOrderRefund`, `updateOrderStatus`), so every rule,
lock and email you already have applies exactly as in the admin screen. For
example: no refund above what's left of the payment; before shipping, refunding
everything has to be a cancel; a refund and a cancel can't run at once; the
group-shipment fee is protected.

The existing `PATCH /orders/:id/status` route still only does shipped and
delivered. Cancelling is its own address, so it can be switched off separately.

## Safety

- **Off switch for money.** Refunds and cancelling only work while the Render
  setting `INTEGRATION_REFUNDS=on` is set. Without it (or with any other value)
  they answer 403 "Refunds from Odoo are switched off", and everything else keeps
  working. Removing the setting turns them off at once, with no code change or
  deploy.
- **Never twice.** Every refund from Odoo must carry Odoo's own `requestId`. If
  Odoo sends the same refund again (it timed out and didn't hear the answer), the
  website answers "Refund already made" and moves no money. The same goes for
  cancelling an order that's already cancelled, and for shipping held items whose
  tracking number has already shipped. A refund the payment provider refused moved
  no money, so it may be tried again.
- **On record.** Everything is recorded as made by the Odoo admin account
  (`INTEGRATION_ADMIN_EMAIL`), like any other admin's change. Without that
  account these addresses refuse the key.
- **Still blocked:** user accounts, the admin order screens and the dashboard,
  exactly as before.

## Code changes

- `backend/routes/integrationRoutes.js`: the five addresses.
- `backend/controllers/integrationController.js`: thin wrappers. They check the
  order id, fill in the tracking link from the carrier (as the shipped route
  already does), and answer repeats as above. Then they hand over to your
  controllers.
- `backend/middlewares/integration.middleware.js`: `requireIntegrationAdmin` and
  `requireIntegrationRefunds` (the switch).
- `backend/controllers/refundController.js` and `backend/models/order.model.js`:
  an optional `requestId` on refund entries, plus the "already made" check (done
  after the refund lock is taken, so two copies can't race). It's only set by the
  Odoo route; refunds from the admin screen are unchanged.
- `ODOO_INTEGRATION.md`: a new "Changing an order from Odoo" section.

No data migration: `requestId` is empty on every existing refund.

## Tested

A new test runs the real backend (`app.js`) against a throwaway in-memory
database, with fake Stripe and Square and a local mail catcher, so nothing can
reach the live site, a real payment account or a real inbox. It passes 31/31,
covering:

- hold back, then ship later
- a partial refund, then a full one
- the same refund sent twice: refunded once
- an amount above what's left: refused
- a refusal from the payment provider, then a retry
- put back in stock, including sending it twice
- cancelling with Square, including sending it twice
- the switch at "", "off", "yes" and "on"
- no admin account set up
- the key still refused on the admin order screens

The earlier #12 tests still pass: refunds 39/39, backorders 35/35, review
fixes 27/27.

## To switch it on (after merging)

1. Deploy as usual. The backorder addresses work straight away. Refunds and
   cancelling stay off.
2. When you're happy, add `INTEGRATION_REFUNDS=on` on Render.

## Questions for you

- Should a customer email for an Odoo refund or cancel look any different from
  one made in the admin screen? Right now they're identical.
- Would you like a per-refund cap (for example, refunds over $X must be made in
  the admin)? It's a small addition if you want it.
