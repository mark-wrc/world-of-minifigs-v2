// Single source of truth for inventory enums shared by backend and frontend.

export const INVENTORY_CATEGORIES = [
  "accessories",
  "animals",
  "minifigs",
  "printed-tiles",
  "specialty-bricks",
  "botanicals",
  "bulk-minifig-parts",
];

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
