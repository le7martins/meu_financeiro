import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey:            "AIzaSyBGTj0GO5afkhAvZgT03mWAJqvkil8vnIA",
  authDomain:        "meu-financeiro-13919.firebaseapp.com",
  projectId:         "meu-financeiro-13919",
  storageBucket:     "meu-financeiro-13919.firebasestorage.app",
  messagingSenderId: "350978430463",
  appId:             "1:350978430463:web:f27515f6fd9d3f35e243ca",
};

const app = initializeApp(firebaseConfig);

// ─── Firebase App Check ───────────────────────────────────────
// Protege a API Key contra uso não autorizado.
// Em dev, ativa o debug token (gera token no console na 1ª execução).
// Em produção, usa reCAPTCHA Enterprise — configure a site key no Firebase Console
// em App Check → Apps → CashUp → reCAPTCHA Enterprise.
// Substitua VITE_RECAPTCHA_SITE_KEY na variável de ambiente (ou .env.local).
try {
  if (import.meta.env.DEV) {
    // Token de debug — nunca exposto em produção
    // eslint-disable-next-line no-restricted-globals
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (recaptchaSiteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
  // Se VITE_RECAPTCHA_SITE_KEY não estiver configurada, App Check fica inativo
  // mas o app continua funcionando (não bloqueia em ausência da key).
} catch (e) {
  console.warn('[AppCheck] Não inicializado:', e.message);
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Messaging só funciona em contextos que suportam SW
export const messaging = await isSupported().then(ok => ok ? getMessaging(app) : null).catch(() => null);
