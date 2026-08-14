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

/** Best-effort browser feedback. Unsupported PWA APIs must never crash React. */
export function announceRestComplete({NotificationApi=globalThis.Notification,navigatorApi=globalThis.navigator,isNative=false}={}) {
  try {
    if(typeof navigatorApi?.vibrate==="function") navigatorApi.vibrate([150,80,150]);
  } catch { /* Vibration is optional. */ }
  if(isNative) return;
  try {
    if(NotificationApi?.permission==="granted") new NotificationApi("Rest complete",{body:"Time for your next set."});
  } catch { /* Some installed PWAs disallow the Notification constructor. */ }
}
