# Odoo connection API

Brick Extreme's Odoo reads orders, products and inventory from the website,
and sends shipping updates back. Everything lives under `/api/v1/integration`.
It does not change any existing page, route or checkout.

## Turning it on

The API is **off** until the server has a key:

1. Make a long random key (at least 32 characters), for example with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
2. In Render, open the web service, go to **Environment**, and add
   `INTEGRATION_API_KEY` with that key. Save; Render restarts the service.
3. Make an admin account for Odoo on the website (for example
   `odoo@brickextreme.com`, role **admin**) and add
   `INTEGRATION_ADMIN_EMAIL` with that email. Everything Odoo changes is
   recorded as made by this account.
4. Put the same key in Odoo's connection settings. Never commit it.

Without the key (or with one shorter than 32 characters) every integration
address answers "Route not found".

Every request sends the key in a header:

```
X-Api-Key: <the key>
```

## Full admin access

With the key, Odoo can use **every admin address** (`/api/v1/admin/...`) exactly
like an admin signed in on the website: create and edit products, inventory,
torso bags, add-ons, flash sales, banners, and so on. The same checks and rules
apply as in the admin screens.

```
X-Api-Key: <the key>
GET /api/v1/admin/general-inventory
PUT /api/v1/admin/general-inventory/:id     { "pricePerBag": 2.5 }
POST /api/v1/admin/dealer/torso-bags        { ... same body as the admin screen sends ... }
```

Pictures work the same way as in the admin screens: ask for an upload signature
(`GET /api/v1/admin/uploads/signature?type=general-inventory`), upload the file
straight to Cloudinary, then send its `publicId` and `url` in the item.

Three areas always refuse the key; only a person signed in to the website admin can use them:

- **User accounts** (`/api/v1/admin/users...`): the user list, roles and tax-exempt status.
- **Admin order screens** (`/api/v1/admin/orders...`), including cancelling, which refunds
  the customer. Odoo reads orders and marks them shipped or delivered through
  `/api/v1/integration/orders` (below), which cannot cancel.
- **The dashboard** (`/api/v1/admin/dashboard...`). Odoo makes its own reports from the
  orders it reads.

If `INTEGRATION_ADMIN_EMAIL` isn't set, or isn't an active admin, the admin
addresses refuse the key. Without the key they work as before (website sign-in).

## Reading

All lists return the oldest change first, at most 100 per page:

```json
{ "success": true, "orders": [ ... ], "pagination": { "page": 1, "limit": 100, "total": 240, "totalPages": 3 } }
```

| Request | What it returns |
|---|---|
| `GET /api/v1/integration/orders` | Orders, with the customer (`userId`: name, email, phone, role) and, for Pay Now / Ship Later orders, the parcel (`shipmentId`) |
| `GET /api/v1/integration/orders/:id` | One order |
| `GET /api/v1/integration/products` | Store products, with colors and stock per variant |
| `GET /api/v1/integration/inventory` | Dealer / wholesale inventory (stock in bags, bin, cost) |

Options for the lists:

- `updatedSince=2026-11-08T22:00:00Z` — only what changed at or after that time
- `page=2`, `limit=50`
- orders only: `status=paid,on_hold` and `orderType=product,dealer,wholesale,reward`

Odoo remembers the newest `updatedAt` it has seen and asks for
`updatedSince=<that time>` next time, so it only downloads changes.

## Stock

`PATCH /api/v1/integration/stock` sets or adjusts stock for up to 200 items at once.

```json
{ "items": [
  { "type": "inventory", "itemId": "973pb1", "stock": 30 },
  { "type": "inventory", "id": "<inventory id>", "change": -2 },
  { "type": "product", "itemId": "3001", "stock": 12 },
  { "type": "product", "id": "<product id>", "variantItemId": "973pb2", "stock": 5 },
  { "type": "torso-bag", "id": "<bag id>", "stock": 40 },
  { "type": "addon", "id": "<add-on id>", "stock": null }
] }
```

- `stock` sets the count; `change` adds (positive) or removes (negative).
  Removing never takes stock below zero. Use `change` when adding or removing a
  few, so a sale that happens at the same moment is never overwritten.
- Whole numbers only, up to 1,000,000.
- A product with colors keeps stock per color: send `variantItemId`.
- `type` is `product`, `inventory`, `torso-bag` or `addon`. Products and inventory
  can be found by `itemId` (for products, a variant's item ID also works); if an
  item ID matches more than one item, send the `id`.
- Add-ons can be set to `null` (not tracked, never sells out).
- Each row is handled on its own. The reply lists every row with `ok` and the new
  `stock`, or the `error` for that row.

## Updating an order

`PATCH /api/v1/integration/orders/:id/status` uses the same rules and the same
customer emails as the admin screen.

Shipped (a courier shipment):

```json
{ "status": "shipped", "carrier": "USPS", "trackingNumber": "9400111899223344556677" }
```

`trackingLink` is optional: for USPS, UPS, FedEx and DHL it is filled in from the
tracking number. Other carriers must send it. If the order is in a paid
Pay Now / Ship Later parcel, the whole parcel is marked shipped. Sending the same
tracking number again changes nothing.

Delivered (handed over in person or picked up):

```json
{ "status": "delivered", "deliveryMethod": "store_pickup", "receivedBy": "Jane", "notes": "" }
```

`deliveryMethod` is `hand_delivered` or `store_pickup`.

Cancelling is not possible with the key at all, because it refunds the customer. It
stays a person's decision in the website admin.

## Files

- `backend/routes/integrationRoutes.js` — the addresses
- `backend/controllers/integrationController.js` — what each one does
- `backend/middlewares/integration.middleware.js` — the key check
