import { getToken, deleteToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { messaging, db } from './firebase';

// VAPID key do Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
const VAPID_KEY = import.meta.env.VITE_VAPID_KEY || '';

export async function registerFCMToken(uid) {
  if (!messaging || !VAPID_KEY) return null;
  try {
    const sw = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: sw });
    if (token) {
      await updateDoc(doc(db, 'userProfiles', uid), { fcmToken: token, fcmUpdated: new Date().toISOString() });
    }
    return token;
  } catch (e) {
    console.warn('[FCM] Falha ao registrar token:', e.message);
    return null;
  }
}

export async function deregisterFCMToken(uid) {
  if (!messaging) return;
  try {
    await deleteToken(messaging);
    await updateDoc(doc(db, 'userProfiles', uid), { fcmToken: deleteField(), fcmUpdated: deleteField() });
  } catch (e) {
    console.warn('[FCM] Falha ao remover token:', e.message);
  }
}

export function onForegroundMessage(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
