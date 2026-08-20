let cache = null;
let byId = null;
let promise = null;

export function loadExerciseLibrary() {
  if (!promise) {
    promise = import("./exerciseLibrary.json", { with: { type: "json" } }).then(module => {
      cache = module.default;
      byId = new Map(cache.map(entry => [entry.id, entry]));
      return cache;
    });
  }
  return promise;
}

export function getExerciseLibrarySync() {
  return cache || [];
}

export function getExerciseLibraryEntrySync(id) {
  return byId?.get(id) || null;
}
