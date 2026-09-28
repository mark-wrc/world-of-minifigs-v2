// Pays a Square Sandbox order directly, without the hosted checkout page.
//
// Sandbox replaces the Square-hosted checkout page with a testing panel that
// has no card form, so there is no way to "type a card" for a payment link.
// The panel is not the only way in: CreatePayment accepts a sandbox test token
// and produces a real COMPLETED payment against the order, which fires the same
// payment.created / payment.updated webhooks the hosted page would have.
// What our webhook handler receives is identical either way.
//
//   node scripts/squareTestPayment.js <squareOrderId> [amountCents]
//
// The order id is what createCheckout returns as `gatewayOrderId`. Omit the
// amount and the order's own total is used.
//
// Sandbox only — it refuses to run against production so a stray test token
// can never be aimed at real money.

import dotenv from "dotenv";
import { randomUUID } from "crypto";
import { getSquare } from "../utils/square.js";

dotenv.config({ path: "./config/config.env", quiet: true });

// Square's "always succeeds" sandbox token. Others worth knowing:
//   cnon:card-nonce-rejected      → payment declined
//   cnon:card-nonce-expired       → expired card
// See developer.squareup.com/docs/devtools/sandbox/payments
const TEST_TOKENS = {
  ok: "cnon:card-nonce-ok",
  declined: "cnon:card-nonce-rejected",
  expired: "cnon:card-nonce-expired",
};

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const run = async () => {
  if (process.env.SQUARE_ENVIRONMENT === "production") {
    fail(
      "SQUARE_ENVIRONMENT is production — this script only runs against sandbox.",
    );
  }

  const [orderId, amountArg, tokenName = "ok"] = process.argv.slice(2);
  if (!orderId) {
    fail("Usage: node scripts/squareTestPayment.js <squareOrderId> [amountCents] [ok|declined|expired]");
  }

  const sourceId = TEST_TOKENS[tokenName];
  if (!sourceId) fail(`Unknown token "${tokenName}" — use ok, declined, or expired.`);

  const square = getSquare();

  // Read the order so we can pay its exact total. Paying a different amount
  // leaves the order partially paid and no payment.updated COMPLETED fires.
  const { order } = await square.orders.get({ orderId });
  if (!order) fail(`Square order ${orderId} not found in sandbox.`);

  const amount = amountArg
    ? BigInt(amountArg)
    : (order.netAmountDueMoney?.amount ?? order.totalMoney?.amount);

  if (!amount) fail("Could not determine an amount to pay — pass amountCents.");

  console.log(`Order   ${orderId}`);
  console.log(`State   ${order.state}`);
  console.log(`Paying  ${Number(amount) / 100} ${order.totalMoney?.currency || "USD"}`);

  const { payment } = await square.payments.create({
    idempotencyKey: randomUUID(),
    sourceId,
    orderId,
    amountMoney: {
      amount,
      currency: order.totalMoney?.currency || "USD",
    },
    // Square requires a location that matches the order's.
    locationId: order.locationId,
  });

  console.log(`\n✓ Payment ${payment.id} → ${payment.status}`);
  console.log(
    "  Webhooks payment.created and payment.updated should now hit your tunnel.",
  );
  console.log("  Watch for the order in Mongo, then re-run to prove idempotency.");
};

run().catch((err) => {
  // Square SDK errors carry the useful detail on .errors, not .message.
  console.error("✗ Square rejected the payment:");
  console.error(err.errors ? JSON.stringify(err.errors, null, 2) : err);
  process.exit(1);
});
