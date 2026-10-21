import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCznVOpLVoS_f_byFrGEUSkyqEZichBoJU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'modulefodge.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'modulefodge',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'modulefodge.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '548620534200',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:548620534200:web:30240fb4d8e0894dd98f4d',
};

// Loud warning when the hardcoded fallback config (project "modulefodge") is in use, so a Vercel
// build that forgot the VITE_FIREBASE_* vars is visible instead of silently using that project.
const fallbackVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
].filter((k) => !(import.meta.env as Record<string, string | undefined>)[k]);
if (fallbackVars.length > 0) {
  console.warn(
    `[firebase] Using hardcoded fallback Firebase config (project "${firebaseConfig.projectId}") because these env vars were not set at build time: ${fallbackVars.join(', ')}. ` +
      'Set VITE_FIREBASE_* in the Vercel project settings and make sure the server FIREBASE_PROJECT_ID matches.'
  );
}

// Initialise Firebase Auth & Firestore with project config
const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const firebaseApp = isConfigured
  ? getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firestore = firebaseApp ? getFirestore(firebaseApp) : null;
export const googleProvider = new GoogleAuthProvider();

export { isConfigured as isFirebaseConfigured };

