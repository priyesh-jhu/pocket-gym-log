export async function retireDevelopmentPWA({
  serviceWorker = typeof navigator === "undefined" ? null : navigator.serviceWorker,
  cacheStorage = typeof caches === "undefined" ? null : caches,
} = {}) {
  const registrations = await serviceWorker?.getRegistrations?.() ?? [];
  await Promise.all(registrations.map((registration) => registration.unregister()));

  const keys = await cacheStorage?.keys?.() ?? [];
  await Promise.all(
    keys
      .filter((key) => key.startsWith("workout-tracker-"))
      .map((key) => cacheStorage.delete(key)),
  );
}
