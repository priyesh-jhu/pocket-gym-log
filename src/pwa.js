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
 * Checks whether a newer version has been deployed than the one currently
 * running. `registration.update()` alone cannot answer this: it only
 * re-fetches the ALREADY-REGISTERED service worker script, and sw.js's own
 * file content never changes between releases (it reads its cache-busting
 * version from the registration URL's query string at runtime, not from its
 * own bytes) — so once a page is running an old cached build, update() will
 * report "no update" forever, even after several real deploys. The one
 * reliable signal is a fresh, no-store fetch of public/version.json (written
 * at build time by scripts/write-version.mjs) compared against this running
 * build's own packageInfo.version.
 *
 * Returns { ok:true, upToDate, latestVersion } on success,
 * { ok:false, reason } otherwise ("not-registered" outside a real PWA
 * context, or "error" on a network/parse failure).
 */
export async function checkForAppUpdate() {
  if (!currentRegistration) return { ok:false, reason:"not-registered" };
  try {
    const res = await fetch("/version.json", { cache:"no-store" });
    if (!res.ok) throw new Error(`version.json fetch failed: ${res.status}`);
    const { version: latestVersion } = await res.json();
    const upToDate = latestVersion === packageInfo.version;
    // Also kick off the normal SW update check — harmless, and picks up the
    // case where the SW itself changed (not just the app version).
    currentRegistration.update().catch(() => {});
    return { ok:true, upToDate, latestVersion };
  } catch (error) {
    return { ok:false, reason:"error", error };
  }
}
