// ─── LOCAL PROFILE HYDRATION ──────────────────────────────────────────────────
// The app has two ways to read a profile's saved data off this device.
//
// The forgiving one (`readStoredArray` in App.jsx) turns any problem into an
// empty array. That is correct for auth reconciliation and import, where a
// single unreadable blob must never block merging the rest.
//
// This one is STRICT, and exists for the screens that own their own visible
// loading/error state (History, Weight). There, "storage threw" and "the JSON
// is corrupt" must never be presented as "you have no workouts" — a user who
// sees an empty history believes their training log is gone. So a failure is
// reported as a result the screen can turn into a retryable error.
//
// Storage keys are a persistence contract: the prefixes below are the same
// strings the app has always used, and they live here so both readers agree.

export const SESSION_PREFIX = "workout-sessions:";
export const WEIGHT_PREFIX = "workout-bodyweight:";

export function sessionKey(profile) { return SESSION_PREFIX + profile; }
export function weightKey(profile) { return WEIGHT_PREFIX + profile; }

// Errors never carry stored workout content or the profile namespace — they are
// surfaced in the UI and must stay free of user data.
function readStrictArray(storage, key, label) {
  const raw = storage.get(key);
  if (raw === null || raw === undefined || raw === "") return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`Saved ${label} on this device are not in the expected format.`);
  return parsed;
}

/**
 * Strict read of one profile's locally saved data.
 * Absent keys are genuinely empty; thrown access, malformed JSON, or a parsed
 * non-array collection is a failure, never a silent empty result.
 */
export function readLocalProfileResult({ storage, profile, loadPrefs }) {
  try {
    if (!storage || typeof storage.get !== "function") throw new Error("Device storage is unavailable.");
    const sessions = readStrictArray(storage, sessionKey(profile), "workouts");
    const bodyweights = readStrictArray(storage, weightKey(profile), "weigh-ins");
    // Preferences are presentation settings, not records: their own loader is
    // total by design and returning {} for them never hides workout data.
    const equipmentPrefs = typeof loadPrefs === "function" ? loadPrefs(storage, profile) : {};
    return { ok: true, data: { sessions, bodyweights, equipmentPrefs }, error: null };
  } catch (error) {
    return { ok: false, data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Drive one load/retry attempt through a screen's own loading and error state.
 * Loading is entered and the previous error cleared before reading; data is
 * applied only on success, and always before loading ends.
 */
export function runLocalProfileLoad({ readResult, setLoading, setError, applyData }) {
  setLoading?.(true);
  setError?.(null);
  let result;
  try {
    result = typeof readResult === "function"
      ? readResult()
      : { ok: false, data: null, error: new Error("No saved-data reader was provided.") };
    if (result?.ok) applyData?.(result.data);
    else setError?.(result?.error || new Error("Saved data on this device could not be read."));
  } catch (error) {
    result = { ok: false, data: null, error: error instanceof Error ? error : new Error(String(error)) };
    setError?.(result.error);
  } finally {
    setLoading?.(false);
  }
  return result;
}
