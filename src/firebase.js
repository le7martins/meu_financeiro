import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:            "AIzaSyBGTj0GO5afkhAvZgT03mWAJqvkil8vnIA",
  authDomain:        "meu-financeiro-13919.firebaseapp.com",
  projectId:         "meu-financeiro-13919",
  storageBucket:     "meu-financeiro-13919.firebasestorage.app",
  messagingSenderId: "350978430463",
  appId:             "1:350978430463:web:f27515f6fd9d3f35e243ca",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Messaging só funciona em contextos que suportam SW
export const messaging = await isSupported().then(ok => ok ? getMessaging(app) : null).catch(() => null);
