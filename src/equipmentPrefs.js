// ─── EQUIPMENT PREFERENCES ────────────────────────────────────────────────────
// Remembers whether each exercise is set to its free-weight or machine variant.
// Keyed by the FREE variant name, which is stable regardless of array ordering.

export const EQUIPMENT_PREFIX = "workout-equipment:";

const VALID = ["free", "machine"];

function key(profile) { return EQUIPMENT_PREFIX + profile; }

/** Stored preferences for a profile. Always returns an object, never throws. */
export function loadPrefs(storage, profile) {
  if (!profile) return {};
  try {
    const raw = storage.get(key(profile));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch { return {}; }
}

/** Persist preferences. Returns false rather than throwing when storage refuses. */
export function savePrefs(storage, profile, prefs) {
  if (!profile) return false;
  try { return storage.set(key(profile), JSON.stringify(prefs)); }
  catch { return false; }
}

/** The equipment chosen for an exercise, defaulting to free. */
export function prefFor(prefs, freeName) {
  const v = prefs && prefs[freeName];
  return VALID.includes(v) ? v : "free";
}

/** A copy of `prefs` with one exercise's equipment changed. Never mutates. */
export function setPref(prefs, freeName, equipment) {
  return { ...prefs, [freeName]: VALID.includes(equipment) ? equipment : "free" };
}
