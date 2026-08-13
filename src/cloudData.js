import { mergeBackup } from "./backup.js";

/** Reconcile device data with schema-v2 cloud collections and legacy payloads. */
export function reconcileCloudData(local, cloud) {
  let merged = local;
  if (cloud?.legacy) merged = mergeBackup(merged, cloud.legacy);
  if (cloud) merged = mergeBackup(merged, cloud);

  const deletedSessions = new Set((cloud?.deletedSessionIds || []).map(String));
  const deletedWeights = new Set((cloud?.deletedWeightDates || []).map(String));
  return {
    ...merged,
    sessions:merged.sessions.filter(item => !deletedSessions.has(String(item.id))),
    bodyweights:merged.bodyweights.filter(item => !deletedWeights.has(String(item.date))),
  };
}
