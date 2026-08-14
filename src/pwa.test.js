import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { retireDevelopmentPWA } from "./pwaDevelopment.js";

test("development PWA cleanup unregisters workers and removes only app caches", async () => {
  const calls = [];
  const serviceWorker = {
    async getRegistrations() {
      return [
        { unregister: async () => calls.push("unregister:one") },
        { unregister: async () => calls.push("unregister:two") },
      ];
    },
  };
  const cacheStorage = {
    async keys() {
      return ["workout-tracker-1.4.0", "unrelated-cache"];
    },
    async delete(key) {
      calls.push(`delete:${key}`);
      return true;
    },
  };

  await retireDevelopmentPWA({ serviceWorker, cacheStorage });

  assert.deepEqual(calls.sort(), [
    "delete:workout-tracker-1.4.0",
    "unregister:one",
    "unregister:two",
  ]);
});

test("development PWA cleanup tolerates unavailable browser APIs", async () => {
  await assert.doesNotReject(retireDevelopmentPWA({ serviceWorker: null, cacheStorage: null }));
});

test("service worker bypasses fetch caching on development hosts", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

  assert.match(source, /IS_DEVELOPMENT_HOST/);
  assert.match(source, /if \(IS_DEVELOPMENT_HOST\) return;/);
  assert.match(source, /event\.waitUntil\(self\.skipWaiting\(\)\)/);
});
