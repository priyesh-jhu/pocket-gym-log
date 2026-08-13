import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
const app = firebaseConfigured ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

function withTimeout(promise, action) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`${action} timed out.`), { code:"cloud/timeout" })), 12000);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const encoded = value => encodeURIComponent(String(value));
const userCollection = (uid, name) => collection(db, "users", uid, name);
const userDoc = (uid, name, id) => doc(db, "users", uid, name, encoded(id));
const legacyProfileRef = (uid, profile) => doc(db, "users", uid, "profiles", profile);

export function observeAuth(callback) {
  if (!auth) { callback(null); return () => {}; }
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  if (!auth) throw new Error("Firebase is not configured.");
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signOutFirebase() {
  if (auth) await signOut(auth);
}

/** Load schema-v2 collections plus the old single-document payload for migration. */
export async function loadCloudData(uid) {
  if (!db || !uid) return null;
  const [sessionSnap, weightSnap, settingsSnap, legacyMain, legacyDefault] = await withTimeout(Promise.all([
    getDocs(userCollection(uid, "sessions")),
    getDocs(userCollection(uid, "bodyweights")),
    getDoc(userDoc(uid, "settings", "main")),
    getDoc(legacyProfileRef(uid, "main")),
    getDoc(legacyProfileRef(uid, "default")),
  ]), "Firestore read");

  const sessions = [], deletedSessionIds = [];
  for (const item of sessionSnap.docs) {
    const value = item.data();
    if (value.deleted) deletedSessionIds.push(decodeURIComponent(item.id));
    else if (value.session) sessions.push(value.session);
  }
  const bodyweights = [], deletedWeightDates = [];
  for (const item of weightSnap.docs) {
    const value = item.data();
    if (value.deleted) deletedWeightDates.push(decodeURIComponent(item.id));
    else if (value.entry) bodyweights.push(value.entry);
  }

  const settings = settingsSnap.exists() ? settingsSnap.data() : {};
  const legacy = legacyMain.exists() ? legacyMain.data() : legacyDefault.exists() ? legacyDefault.data() : null;
  return {
    sessions,
    bodyweights,
    equipmentPrefs: settings.equipmentPrefs || {},
    deletedSessionIds,
    deletedWeightDates,
    legacy,
  };
}

export async function saveCloudSession(uid, session) {
  if (!db || !uid || !session?.id) return false;
  await withTimeout(setDoc(userDoc(uid, "sessions", session.id), { session, deleted:false, updatedAt:serverTimestamp() }), "Firestore write");
  return true;
}

export async function deleteCloudSession(uid, id) {
  if (!db || !uid || !id) return false;
  await withTimeout(setDoc(userDoc(uid, "sessions", id), { deleted:true, updatedAt:serverTimestamp() }), "Firestore write");
  return true;
}

export async function saveCloudBodyweight(uid, entry) {
  if (!db || !uid || !entry?.date) return false;
  await withTimeout(setDoc(userDoc(uid, "bodyweights", entry.date), { entry, deleted:false, updatedAt:serverTimestamp() }), "Firestore write");
  return true;
}

export async function deleteCloudBodyweight(uid, date) {
  if (!db || !uid || !date) return false;
  await withTimeout(setDoc(userDoc(uid, "bodyweights", date), { deleted:true, updatedAt:serverTimestamp() }), "Firestore write");
  return true;
}

export async function saveCloudSettings(uid, equipmentPrefs, account) {
  if (!db || !uid) return false;
  await withTimeout(setDoc(userDoc(uid, "settings", "main"), {
    schemaVersion:2,
    equipmentPrefs:equipmentPrefs || {},
    account:account || {},
    updatedAt:serverTimestamp(),
  }, { merge:true }), "Firestore write");
  return true;
}

async function commitOperations(operations) {
  for (let start = 0; start < operations.length; start += 400) {
    const batch = writeBatch(db);
    for (const apply of operations.slice(start, start + 400)) apply(batch);
    await withTimeout(batch.commit(), "Firestore batch write");
  }
}

/** Bulk migration/import. replace=true writes tombstones for records not in data. */
export async function saveCloudSnapshot(uid, data, { replace=false } = {}) {
  if (!db || !uid) return false;
  const operations = [];
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const bodyweights = Array.isArray(data.bodyweights) ? data.bodyweights : [];

  for (const session of sessions) {
    if (session?.id) operations.push(batch => batch.set(userDoc(uid, "sessions", session.id), { session, deleted:false, updatedAt:serverTimestamp() }));
  }
  for (const entry of bodyweights) {
    if (entry?.date) operations.push(batch => batch.set(userDoc(uid, "bodyweights", entry.date), { entry, deleted:false, updatedAt:serverTimestamp() }));
  }

  if (replace) {
    const [existingSessions, existingWeights] = await withTimeout(Promise.all([
      getDocs(userCollection(uid, "sessions")), getDocs(userCollection(uid, "bodyweights")),
    ]), "Firestore read");
    const wantedSessions = new Set(sessions.map(item => encoded(item.id)));
    const wantedWeights = new Set(bodyweights.map(item => encoded(item.date)));
    for (const item of existingSessions.docs) if (!wantedSessions.has(item.id)) operations.push(batch => batch.set(item.ref, { deleted:true, updatedAt:serverTimestamp() }));
    for (const item of existingWeights.docs) if (!wantedWeights.has(item.id)) operations.push(batch => batch.set(item.ref, { deleted:true, updatedAt:serverTimestamp() }));
  }

  operations.push(batch => batch.set(userDoc(uid, "settings", "main"), {
    schemaVersion:2,
    equipmentPrefs:data.equipmentPrefs || {},
    account:data.account || {},
    updatedAt:serverTimestamp(),
  }, { merge:true }));
  await commitOperations(operations);
  return true;
}
