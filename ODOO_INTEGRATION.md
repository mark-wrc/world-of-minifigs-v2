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
3. Put the same key in Odoo's connection settings. Never commit it.

Without the key (or with one shorter than 32 characters) every integration
address answers "Route not found".

Every request sends the key in a header:

```
X-Api-Key: <the key>
```

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

Cancelling is **not** available here, because it refunds the customer; it stays
in the website admin.

## Files

- `backend/routes/integrationRoutes.js` — the addresses
- `backend/controllers/integrationController.js` — what each one does
- `backend/middlewares/integration.middleware.js` — the key check
