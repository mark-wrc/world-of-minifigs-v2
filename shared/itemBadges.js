// Single source of truth for the merchandising badge carried by a general
// inventory item. An item holds AT MOST ONE badge (a select in the admin form,
// not a set of switches) — so "Featured" and "Latest Drop" are mutually
// exclusive by construction.
//
// TO ADD A NEW BADGE: append one entry to ITEM_BADGES below. Everything derives
// from this list — the Mongoose enum, the admin form select, the pill on the
// add-on preview card, the admin table badge, and the dealer sort options.
// The only thing outside this file is the icon lookup: if you pick an `icon`
// name that isn't already in BADGE_ICONS
// (frontend/src/components/shared/ItemBadge.jsx) add it to that map too,
// otherwise it falls back to a generic tag icon.

export const ITEM_BADGES = [
  {
    value: "featured",
    label: "Featured",
    // Shown as the helper text under the badge select in the admin form.
    description: "Marks the item as a hand-picked highlight.",
    // Key into BADGE_ICONS on the frontend (see note above).
    icon: "crown",
    // Palette for the pill on the add-on preview card. Layout/base classes live
    // in <ItemBadge />; only colours belong here.
    pillClassName:
      "bg-gradient-to-b from-zinc-800 to-zinc-950 text-amber-300 ring-amber-300/40",
    // Right padding the card's title row needs so the pill never overlaps it.
    // Widen this if the label is long.
    clearanceClassName: "pr-20",
    // <Badge /> variant used for the compact badge in the admin table.
    tableVariant: "warning",
  },
  {
    value: "latest-drop",
    label: "Latest Drop",
    description: "Marks the item as a new arrival.",
    icon: "sparkles",
    pillClassName:
      "bg-gradient-to-b from-emerald-500 to-emerald-700 text-white ring-emerald-300/50",
    clearanceClassName: "pr-24",
    tableVariant: "success",
  },
];

// Sentinel used by the admin select — Radix selects can't hold an empty value,
// so "no badge" travels as this string and is normalised back to null server-side.
export const NO_BADGE = "none";

export const ITEM_BADGE_VALUES = ITEM_BADGES.map((b) => b.value);

// Options for the admin add/update select. "No badge" is first so an unbadged
// item is the default choice.
export const ITEM_BADGE_OPTIONS = [
  { value: NO_BADGE, label: "No badge" },
  ...ITEM_BADGES.map(({ value, label }) => ({ value, label })),
];

export const getItemBadge = (value) =>
  ITEM_BADGES.find((b) => b.value === value) || null;

// Coerces anything a client sends (undefined, "", NO_BADGE, a removed badge
// value) into either a valid badge value or null.
export const normalizeItemBadge = (value) =>
  ITEM_BADGE_VALUES.includes(value) ? value : null;
