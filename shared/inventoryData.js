// Single source of truth for inventory enums shared by backend and frontend.

export const INVENTORY_CATEGORIES = [
  "accessories",
  "animals",
  "minifigs",
  "printed-tiles",
  "specialty-bricks",
  "botanicals",
  "bulk-minifig-parts",
  "minidoll",
];

// Categories sold as individual figures, where a "piece" is a minifig/minidoll.
// These show "X minifigs/bag" instead of the generic "X pcs/bag".
export const MINIFIG_CATEGORIES = ["minifigs", "minidoll"];

// Unit label for the per-bag piece count, based on the inventory category.
export const perBagUnit = (category) =>
  MINIFIG_CATEGORIES.includes(category) ? "minifigs/bag" : "pcs/bag";

// Fixed part-type "collections" available for bulk-minifig-parts inventory.
// These are not Collection documents — they're a closed enum used only for this category.
export const BULK_MINIFIG_PART_TYPES = [
  "Printed Torso",
  "Solid Color Torso",
  "Printed Legs",
  "Solid Color Legs",
  "Short Legs",
  "Mid-sized Legs",
  "Women's Hair",
  "Men's Hair",
  "Headgear",
  "Heads",
];
