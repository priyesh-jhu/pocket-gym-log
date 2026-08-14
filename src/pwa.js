import { Capacitor } from "@capacitor/core";
import packageInfo from "../package.json";
import { retireDevelopmentPWA } from "./pwaDevelopment.js";

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
