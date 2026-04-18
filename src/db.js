import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

// Estrutura: users/{uid}/data/{type} → { v: <valor> }
const dataDoc = (uid, type) => doc(db, 'users', uid, 'data', type);

const DATA_TYPES = ['entries', 'dividas', 'cards', 'purchases', 'faturas', 'settings'];

// Carrega todos os dados do usuário de uma vez
export async function loadUserData(uid) {
  const results = await Promise.all(
    DATA_TYPES.map(async t => {
      const snap = await getDoc(dataDoc(uid, t));
      return [t, snap.exists() ? snap.data().v : null];
    })
  );
  return Object.fromEntries(results.filter(([, v]) => v !== null));
}

// Salva um tipo de dado no Firestore (não-bloqueante para o UI)
export function saveData(uid, type, value) {
  return setDoc(dataDoc(uid, type), { v: value }).catch(e =>
    console.warn('[Firestore] Falha ao salvar', type, e)
  );
}

// Verifica se o usuário já tem dados no Firestore
export async function hasCloudData(uid) {
  const snap = await getDoc(dataDoc(uid, 'entries'));
  return snap.exists();
}
