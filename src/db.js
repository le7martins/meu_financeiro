import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export const ADMIN_EMAIL = 'gomesmartins2302@gmail.com';

// Estrutura: users/{uid}/data/{type} → { v: <valor> }
const dataDoc = (uid, type) => doc(db, 'users', uid, 'data', type);

const DATA_TYPES = ['entries', 'dividas', 'cards', 'purchases', 'faturas', 'settings'];

export async function loadUserData(uid) {
  const results = await Promise.all(
    DATA_TYPES.map(async t => {
      const snap = await getDoc(dataDoc(uid, t));
      return [t, snap.exists() ? snap.data().v : null];
    })
  );
  return Object.fromEntries(results.filter(([, v]) => v !== null));
}

export function saveData(uid, type, value) {
  return setDoc(dataDoc(uid, type), { v: value }).catch(e =>
    console.warn('[Firestore] Falha ao salvar', type, e)
  );
}

export async function hasCloudData(uid) {
  const snap = await getDoc(dataDoc(uid, 'entries'));
  return snap.exists();
}

// ─── Perfis de usuário (para painel admin) ───────────────────
export function saveUserProfile(user) {
  const profile = {
    uid:         user.uid,
    email:       user.email || '',
    displayName: user.displayName || '',
    photoURL:    user.photoURL || '',
    lastLogin:   new Date().toISOString(),
    createdAt:   user.metadata?.creationTime || new Date().toISOString(),
    provider:    user.providerData?.[0]?.providerId || 'password',
  };
  return setDoc(doc(db, 'userProfiles', user.uid), profile, { merge: true })
    .catch(e => console.warn('[Firestore] Falha ao salvar perfil:', e));
}

export async function loadAllProfiles() {
  const snap = await getDocs(collection(db, 'userProfiles'));
  return snap.docs.map(d => d.data());
}
