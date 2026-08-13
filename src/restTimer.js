export const REST_TIMER_PREF_KEY = "__restTimerSeconds";
export const REST_TIMER_OPTIONS = [60, 90, 120];

export function getRestTimerSeconds(prefs) {
  const value = Number(prefs?.[REST_TIMER_PREF_KEY]);
  return REST_TIMER_OPTIONS.includes(value) ? value : 90;
}

export function setRestTimerSeconds(prefs, seconds) {
  const value = Number(seconds);
  if (!REST_TIMER_OPTIONS.includes(value)) return { ...(prefs || {}) };
  return { ...(prefs || {}), [REST_TIMER_PREF_KEY]:value };
}
