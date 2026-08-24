// Writes public/version.json so a stale, already-running client can fetch a
// fresh copy at any time and compare it against its own baked-in version —
// the only reliable way to detect a new deploy. `registration.update()`
// alone cannot: it only re-checks the already-registered service worker
// script, and sw.js's own file content never changes between releases (see
// checkForAppUpdate() in src/pwa.js for the full explanation).
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import packageInfo from "../package.json" with { type: "json" };

const OUT = resolve(import.meta.dirname, "../public/version.json");

await writeFile(OUT, JSON.stringify({ version: packageInfo.version }));
console.log(`Wrote ${OUT} (${packageInfo.version})`);
