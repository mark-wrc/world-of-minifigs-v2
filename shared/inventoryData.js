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

// Human-readable label for a category value (kebab-case → Title Case).
// e.g. "bulk-minifig-parts" → "Bulk Minifig Parts".
export const categoryLabel = (value) =>
  value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

// { value, label } options for every category. Use this for tabs/selects so
// adding a category above automatically surfaces everywhere (general inventory,
// dealer add-ons, etc.).
export const INVENTORY_CATEGORY_OPTIONS = INVENTORY_CATEGORIES.map((value) => ({
  value,
  label: categoryLabel(value),
}));

// Categories sold as individual figures, where a "piece" is a minifig.
// These show "X minifigs/bag" instead of the generic "X pcs/bag".
export const MINIFIG_CATEGORIES = ["minifigs"];

// Unit label for the per-bag piece count, based on the inventory category.
// Pass `count` so the unit is singular for a single piece, e.g. "minifig/bag"
// (count 1) vs "minifigs/bag" (count > 1). Always keeps the "/bag" suffix.
export const perBagUnit = (category, count) => {
  const isMinifig = MINIFIG_CATEGORIES.includes(category);
  const noun = isMinifig ? "minifig" : "pc";
  return `${noun}${count === 1 ? "" : "s"}/bag`;
};

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
