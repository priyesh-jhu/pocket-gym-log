let cache = null;
let byId = null;
let promise = null;

export function loadExerciseLibrary() {
  if (!promise) {
    promise = import("./exerciseLibrary.json", { with: { type: "json" } }).then(module => {
      cache = module.default;
      byId = new Map(cache.map(entry => [entry.id, entry]));
      return cache;
    }).catch(err => {
      promise = null;
      throw err;
    });
  }
  return promise;
}

export function getExerciseLibraryEntrySync(id) {
  return byId?.get(id) || null;
}
