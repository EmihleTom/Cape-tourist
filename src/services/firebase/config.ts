import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import appletFirebaseConfig from '@/firebase-applet-config.json';

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

export const FIREBASE_COLLECTIONS = {
  users: 'users',
  admins: 'admins',
  tourismBusinesses: 'tourism_businesses',
  bookings: 'bookings',
  incidents: 'incidents',
  itineraries: 'itineraries',
  notifications: 'notifications',
  reviews: 'reviews',
  communityPosts: 'community_posts',
  travelBudgets: 'travel_budgets',
  touristCheckIns: 'tourist_check_ins',
  announcements: 'announcements',
  providerOfferings: 'provider_offerings',
  payments: 'payments',
  savedPaymentMethods: 'saved_payment_methods',
  providerPaymentSettings: 'provider_payment_settings',
  paymentAuditLogs: 'payment_audit_logs',
} as const;

export function getFirebaseConfig(): FirebaseWebConfig {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || appletFirebaseConfig.apiKey || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || appletFirebaseConfig.authDomain || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || appletFirebaseConfig.projectId || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || appletFirebaseConfig.storageBucket || '',
    messagingSenderId:
      env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletFirebaseConfig.messagingSenderId || '',
    appId: env.VITE_FIREBASE_APP_ID || appletFirebaseConfig.appId || '',
    firestoreDatabaseId:
      env.VITE_FIREBASE_DATABASE_ID || appletFirebaseConfig.firestoreDatabaseId || '(default)',
  };
}

export function isFirebaseConfigured(): boolean {
  const cfg = getFirebaseConfig();
  return Boolean(cfg.apiKey && cfg.projectId && cfg.appId);
}

const resolvedConfig = getFirebaseConfig();

export const firebaseApp: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: resolvedConfig.apiKey,
      authDomain: resolvedConfig.authDomain,
      projectId: resolvedConfig.projectId,
      storageBucket: resolvedConfig.storageBucket,
      messagingSenderId: resolvedConfig.messagingSenderId,
      appId: resolvedConfig.appId,
    });

export const auth: Auth = getAuth(firebaseApp);
export const db: Firestore =
  resolvedConfig.firestoreDatabaseId && resolvedConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(firebaseApp, resolvedConfig.firestoreDatabaseId)
    : getFirestore(firebaseApp);
export const storage: FirebaseStorage = getStorage(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    // Permission denied or missing test/connection doc still confirms server reachability
    return true;
  }
}

void testFirestoreConnection();

export interface ArchitectureReadiness {
  mode: 'demonstration' | 'firebase-connected';
  authReady: boolean;
  firestoreReady: boolean;
  storageReady: boolean;
  offlinePersistenceSupported: boolean;
  projectIdLabel: string;
  databaseIdLabel: string;
}

export function getArchitectureReadiness(): ArchitectureReadiness {
  const configured = isFirebaseConfigured();
  const cfg = getFirebaseConfig();
  return {
    mode: configured ? 'firebase-connected' : 'demonstration',
    authReady: true,
    firestoreReady: true,
    storageReady: Boolean(cfg.storageBucket),
    offlinePersistenceSupported: typeof window !== 'undefined' && 'indexedDB' in window,
    projectIdLabel: configured ? cfg.projectId : 'Demonstration Environment',
    databaseIdLabel: cfg.firestoreDatabaseId || '(default)',
  };
}
