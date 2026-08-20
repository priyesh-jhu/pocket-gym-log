import { Capacitor } from "@capacitor/core";
import packageInfo from "../package.json";
import { retireDevelopmentPWA } from "./pwaDevelopment.js";

// Shared with checkForAppUpdate() below, so a manual "Check for updates" button
// anywhere in the app (e.g. Settings) can reuse the same registration that
// registerWorkoutPWA sets up at startup, without prop-drilling it through App.jsx.
let currentRegistration = null;

export function registerWorkoutPWA({onUpdate}={}) {
  if (Capacitor.isNativePlatform()) return () => {};
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return () => {};
  if (import.meta.env?.DEV) {
    // A production service worker left behind on localhost can cache Vite's
    // transformed modules independently. Mixing those generations gives React
    // and react-dom different hook dispatchers, so retire it before dev work.
    retireDevelopmentPWA().catch(error=>console.error("Development service worker cleanup failed",error));
    return () => {};
  }
  let refreshing=false;
  const controllerChanged=()=>{ if (!refreshing) { refreshing=true; window.location.reload(); } };
  navigator.serviceWorker.addEventListener("controllerchange",controllerChanged);

  navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(packageInfo.version)}`).then(registration=>{
    currentRegistration=registration;
    const offer=worker=>onUpdate?.(()=>worker?.postMessage({type:"SKIP_WAITING"}));
    if (registration.waiting) offer(registration.waiting);
    registration.addEventListener("updatefound",()=>{
      const worker=registration.installing;
      worker?.addEventListener("statechange",()=>{
        if (worker.state==="installed" && navigator.serviceWorker.controller) offer(worker);
      });
    });
  }).catch(error=>console.error("Service worker registration failed",error));

  return ()=>navigator.serviceWorker.removeEventListener("controllerchange",controllerChanged);
}

/**
 * Forces an immediate check against the network for a newer service worker,
 * instead of waiting for the browser's own periodic check. If a new version
 * is found, the existing registerWorkoutPWA() update-found listener fires as
 * usual and the app's update banner appears — this just triggers that check
 * on demand. Returns { ok, upToDate } on success, { ok:false, reason } otherwise.
 */
export async function checkForAppUpdate() {
  if (!currentRegistration) return { ok:false, reason:"not-registered" };
  try {
    await currentRegistration.update();
    return { ok:true, upToDate: !currentRegistration.installing && !currentRegistration.waiting };
  } catch (error) {
    return { ok:false, reason:"error", error };
  }
}
