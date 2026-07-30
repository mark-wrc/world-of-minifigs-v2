import mongoose from "mongoose";

// A flash sale is a time-boxed campaign with ONE shared window (startAt → endAt)
// and a list of participating General Inventory items, each carrying its own
// discount. The window lives once on the campaign so editing it moves all items
// at once; the per-item discount lives on each line so amounts can differ.
//
// Pricing is NEVER driven by a stored "active" flag — a sale is active purely by
// clock time (see utils/flashSale/resolver.js). `isEnabled` is a manual master
// switch to stage a sale ahead of time or pause/cancel one early.
const flashSaleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // The single shared window. All participants share this.
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },

    // Master on/off independent of the window. A sale only discounts prices when
    // it is both enabled AND inside its window.
    isEnabled: { type: Boolean, default: true },

    // Participants — one line per discounted inventory item.
    items: [
      {
        _id: false,
        inventoryItemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "GeneralInventory",
          required: true,
        },
        // Per-item discount off the item's live pricePerBag.
        discountType: {
          type: String,
          enum: ["percent", "fixed"],
          required: true,
        },
        discountValue: { type: Number, required: true, min: 0 },
        // Base price captured when the item was added — admin reference / audit
        // only. Live pricing always reads the item's CURRENT pricePerBag.
        basePriceAtAdd: { type: Number, default: null },
      },
    ],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

/* ----------------------------- Indexes ----------------------------- */

// "Is there an active sale right now" — the hot path used by every read/checkout.
flashSaleSchema.index({ isEnabled: 1, startAt: 1, endAt: 1 });
// "Does this item have a sale" — reverse lookup for validation / inventory badge.
flashSaleSchema.index({ "items.inventoryItemId": 1 });
// Default listing order (newest first).
flashSaleSchema.index({ createdAt: -1 });

const FlashSale = mongoose.model("FlashSale", flashSaleSchema);

export default FlashSale;
