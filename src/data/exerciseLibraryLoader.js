let cache = null;
let byId = null;
let promise = null;

function setCache(data) {
  cache = data;
  byId = new Map(cache.map(entry => [entry.id, entry]));
  return cache;
}

// Fetches the public/exercise-library.json static asset at runtime, rather
// than a dynamic `import(..., { with: { type: "json" } })` of the src/data/
// copy: Node's native ESM loader requires that import attribute, but Vite's
// bundler doesn't reliably rewrite the specifier to its hashed output path
// when the attribute is present on a *dynamic* import, producing a 404 in
// the deployed build. A plain fetch() against a public/ static asset has
// none of that risk and matches the same pattern already used for the
// exercise images.
export function loadExerciseLibrary() {
  if (!promise) {
    promise = fetch("/exercise-library.json").then(res => {
      if (!res.ok) throw new Error(`Failed to fetch exercise library: ${res.status}`);
      return res.json();
    }).then(setCache).catch(err => {
      promise = null;
      throw err;
    });
  }
  return promise;
}

/** Test-only seam: fetch() isn't available in the plain Node test runner
 * this project uses, so tests prime the cache directly with data from a
 * static import instead of exercising the real network path. */
export function primeExerciseLibraryCacheForTests(data) {
  promise = Promise.resolve(setCache(data));
}

export function getExerciseLibraryEntrySync(id) {
  return byId?.get(id) || null;
}
