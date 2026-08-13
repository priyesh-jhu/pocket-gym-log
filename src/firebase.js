import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

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

function profileRef(uid, profile) {
  return doc(db, "users", uid, "profiles", encodeURIComponent(profile));
}

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

export async function loadCloudProfile(uid, profile) {
  if (!db || !uid || !profile) return null;
  const snapshot = await withTimeout(getDoc(profileRef(uid, profile)), "Firestore read");
  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveCloudProfile(uid, profile, data) {
  if (!db || !uid || !profile) return false;
  await withTimeout(setDoc(profileRef(uid, profile), {
    version: 1,
    profile,
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    bodyweights: Array.isArray(data.bodyweights) ? data.bodyweights : [],
    equipmentPrefs: data.equipmentPrefs && typeof data.equipmentPrefs === "object" ? data.equipmentPrefs : {},
    account: data.account && typeof data.account === "object" ? data.account : {},
    updatedAt: serverTimestamp(),
  }), "Firestore write");
  return true;
}

export async function deleteCloudProfile(uid, profile) {
  if (!db || !uid || !profile) return false;
  await deleteDoc(profileRef(uid, profile));
  return true;
}
