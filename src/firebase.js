import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// ─────────────────────────────────────────────────────────────────
//  Substitua pelos valores do seu projeto no Firebase Console:
//  https://console.firebase.google.com → Configurações do projeto
// ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FB_API_KEY            || "",
  authDomain:        import.meta.env.VITE_FB_AUTH_DOMAIN        || "",
  projectId:         import.meta.env.VITE_FB_PROJECT_ID         || "",
  storageBucket:     import.meta.env.VITE_FB_STORAGE_BUCKET     || "",
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER   || "",
  appId:             import.meta.env.VITE_FB_APP_ID             || "",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
