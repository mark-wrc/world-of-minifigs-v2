// Persists the dealer / wholesale order builder selections so they survive
// the Stripe Checkout round-trip (a "back" or "cancel" from Stripe is a fresh
// page load, which would otherwise wipe the React state in useDealer).

const KEYS = {
  dealer: "dealer-order-draft",
  wholesale: "wholesale-order-draft",
};

// Drafts older than this are treated as stale and discarded on load.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const keyFor = (channel) => KEYS[channel] ?? null;

export const loadDealerDraft = (channel) => {
  const key = keyFor(channel);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.state || null;
  } catch {
    return null;
  }
};

export const saveDealerDraft = (channel, state) => {
  const key = keyFor(channel);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), state }));
  } catch {
    // Storage quota / disabled — silently skip.
  }
};

export const clearDealerDraft = (channel) => {
  const key = keyFor(channel);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
};
