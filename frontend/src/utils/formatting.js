export const sanitizeString = (value) => (value ?? "").toString().trim();

// Normalize free-typed text into a clean non-negative integer string suitable
// for a controlled input: keep digits only (so "e", "+", "-", "." and pasted
// junk are dropped), strip leading zeros, and cap at `max`. Returns "" for empty
// input so a field can still be cleared while typing. This is what prevents
// values like "05000000000000" from ever reaching a stock/quantity field.
export const sanitizeIntegerInput = (value, { max } = {}) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits === "") return "";
  // Drop leading zeros but keep a lone "0".
  const normalized = digits.replace(/^0+(?=\d)/, "");
  if (max != null && Number(normalized) > max) return String(max);
  return normalized;
};

// Like sanitizeIntegerInput but permits a single decimal point — for money /
// percentage fields. Keeps digits + one ".", strips leading zeros (keeping a
// lone "0" before a decimal, so "0.5" survives), limits to `decimals` places,
// and caps at `max`. Prevents junk like "000", "055", or "05.5" from ever
// reaching the field while still allowing a value to be cleared mid-type.
export const sanitizeDecimalInput = (value, { max, decimals = 2 } = {}) => {
  let s = String(value ?? "").replace(/[^\d.]/g, "");
  // Collapse to a single decimal point (keep the first).
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  if (s === "") return "";

  let [intPart, decPart] = s.split(".");
  // Strip leading zeros in the integer part, keeping a lone "0".
  intPart = intPart.replace(/^0+(?=\d)/, "");
  if (intPart === "") intPart = "0";
  if (decPart !== undefined) decPart = decPart.slice(0, decimals);

  const result = decPart !== undefined ? `${intPart}.${decPart}` : intPart;
  if (max != null && Number(result) > max) return String(max);
  return result;
};

export const sanitizeOptional = (value) => {
  const trimmed = sanitizeString(value);
  return trimmed || undefined;
};

export const getInitials = (user) => {
  if (!user?.firstName || !user?.lastName) {
    return user?.username?.charAt(0)?.toUpperCase() || "U";
  }
  return (
    user.firstName.charAt(0).toUpperCase() +
    user.lastName.charAt(0).toUpperCase()
  );
};

export const formatFullName = (user) => {
  if (!user?.firstName && !user?.lastName) return "-";
  return `${user.firstName || ""} ${user.lastName || ""}`.trim();
};

export const formatCurrency = (value) => {
  if (value === null || value === undefined) return "-";

  const num = Number(value);
  if (isNaN(num)) return "-";

  return `$${num.toFixed(2)}`;
};

export const getProductDisplayInfo = (product) => ({
  displayPrice: product?.discountPrice ?? product?.price,
  hasDiscount: Boolean(product?.discountPrice),
});

export const parseArrayParam = (param) =>
  param?.split(",").filter(Boolean) || [];

export const toggleArrayItem = (array, item) =>
  array.includes(item) ? array.filter((id) => id !== item) : [...array, item];

export const toggleSetItem = (set, item) => {
  const newSet = new Set(set);
  newSet.has(item) ? newSet.delete(item) : newSet.add(item);
  return newSet;
};

export const formatDate = (date) => {
  if (!date) return "-";

  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

// Compact, date-only format — e.g. "1/1/26".
export const formatDateShort = (date) => {
  if (!date) return "-";

  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleDateString("en-US", {
    year: "2-digit",
    month: "numeric",
    day: "numeric",
  });
};

export const cleanFeatures = (features) =>
  (features || []).map((f) => String(f ?? "").trim()).filter((f) => f !== "");

export const display = (value) =>
  value === null || value === undefined || value === "" ? "-" : value;

export const sortByName = (items = [], key) =>
  [...items].sort((a, b) => (a[key] || "").localeCompare(b[key] || ""));

// Formats E.164 phone numbers (e.g. +18017810705) to (801) 781-0705.
// Falls back to the raw value for unrecognized formats.
export const formatPhone = (phone) => {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  // US 10-digit or 11-digit starting with 1
  const ten =
    digits.length === 10
      ? digits
      : digits.length === 11 && digits[0] === "1"
        ? digits.slice(1)
        : null;
  if (ten) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  return phone;
};
