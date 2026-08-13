import { Capacitor } from "@capacitor/core";
import packageInfo from "../package.json";

export function registerWorkoutPWA({onUpdate}={}) {
  if (Capacitor.isNativePlatform()) return () => {};
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return () => {};
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
