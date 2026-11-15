import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Unsubscribe,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { DEMO_USERS } from '@/src/data/demoData';
import { ROLE_LABELS } from '@/src/data/navigation';
import type { DemoUser, PreferredLanguage, ProfileVisibility, UserRole } from '@/src/types/app';
import { auth, db, FIREBASE_COLLECTIONS, googleProvider, isFirebaseConfigured } from './config';
import { handleFirestoreError, OperationType } from './errorHandler';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  organization?: string;
  accessibilityPriority?: boolean;
}

export interface AuthSessionResult {
  user: DemoUser;
  mode: 'demonstration' | 'firebase';
  message: string;
}

const PENDING_PROFILE_KEY = 'capesafe_pending_profile';
const BOOTSTRAP_ADMIN_EMAIL = 'emihletom07@gmail.com';

interface PendingProfileDraft {
  displayName: string;
  requestedRole: UserRole;
  organization: string;
  accessibilityPriority: boolean;
}

function savePendingProfileDraft(uid: string, draft: PendingProfileDraft) {
  try {
    localStorage.setItem(`${PENDING_PROFILE_KEY}_${uid}`, JSON.stringify(draft));
  } catch {
    // Ignore storage unavailability
  }
}

function loadPendingProfileDraft(uid: string): PendingProfileDraft | null {
  try {
    const raw = localStorage.getItem(`${PENDING_PROFILE_KEY}_${uid}`);
    return raw ? (JSON.parse(raw) as PendingProfileDraft) : null;
  } catch {
    return null;
  }
}

function clearPendingProfileDraft(uid: string) {
  try {
    localStorage.removeItem(`${PENDING_PROFILE_KEY}_${uid}`);
  } catch {
    // Ignore
  }
}

function clampString(val: string, max: number): string {
  return val.trim().slice(0, max);
}

export function mapFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code)
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in your Firebase Console Authentication settings. Enable Email/Password under Authentication > Sign-in method, or use Google Sign-In.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in or resetting your password.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Check your credentials or use Forgot password.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completion.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return error instanceof Error ? error.message : 'Authentication failed. Please try again.';
  }
}

async function ensureBootstrapAdminMarker(fbUser: FirebaseUser) {
  if (
    fbUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL &&
    fbUser.emailVerified
  ) {
    const adminPath = `${FIREBASE_COLLECTIONS.admins}/${fbUser.uid}`;
    try {
      const adminSnap = await getDoc(doc(db, FIREBASE_COLLECTIONS.admins, fbUser.uid));
      if (!adminSnap.exists()) {
        await setDoc(doc(db, FIREBASE_COLLECTIONS.admins, fbUser.uid), {
          uid: fbUser.uid,
          email: fbUser.email,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, adminPath);
    }
  }
}

export async function syncOrFetchUserProfile(
  fbUser: FirebaseUser,
  preferredRole?: UserRole,
  fallbackDisplayName?: string,
  fallbackOrg?: string,
  accessibilityPriority = false
): Promise<DemoUser> {
  const userDocRef = doc(db, FIREBASE_COLLECTIONS.users, fbUser.uid);
  const privateDocRef = doc(db, FIREBASE_COLLECTIONS.users, fbUser.uid, 'private', 'contact');
  const userPath = `${FIREBASE_COLLECTIONS.users}/${fbUser.uid}`;
  const privatePath = `${userPath}/private/contact`;

  const pending = loadPendingProfileDraft(fbUser.uid);
  const resolvedName = clampString(
    fallbackDisplayName || pending?.displayName || fbUser.displayName || fbUser.email?.split('@')[0] || 'CapeSafe Traveler',
    100
  );
  const resolvedRequestedRole: UserRole =
    preferredRole ||
    pending?.requestedRole ||
    (fbUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL ? 'admin' : 'tourist');
  const resolvedOrg = clampString(
    fallbackOrg || pending?.organization || 'Independent Traveler',
    140
  );
  const resolvedAccessibility = pending?.accessibilityPriority ?? accessibilityPriority;

  // Unverified email/password user: cannot write Firestore per security rule `email_verified == true`.
  // Return local session view until email verification is confirmed.
  if (!fbUser.emailVerified) {
    return {
      id: fbUser.uid,
      name: resolvedName,
      email: fbUser.email || '',
      role: 'tourist',
      requestedRole: resolvedRequestedRole,
      roleTitle: ROLE_LABELS.tourist.label,
      organization: resolvedOrg,
      location: 'Cape Town, Western Cape',
      avatarUrl: fbUser.photoURL || undefined,
      passId: `CS360-${fbUser.uid.slice(0, 6).toUpperCase()}`,
      emergencyContact: 'Add in User Settings after email verification',
      accessibilityPriority: resolvedAccessibility,
      profileVisibility: 'public_guides',
      shareLocationConsent: false,
      aiContextPersonalization: true,
      preferredLanguage: 'English',
      emailVerified: false,
      authMode: 'firebase',
      dataOrigin: 'live',
    };
  }

  await ensureBootstrapAdminMarker(fbUser);

  let userSnap;
  try {
    userSnap = await getDoc(userDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!userSnap.exists()) {
    const initialRole: UserRole = 'tourist';
    const baseProfile = {
      uid: fbUser.uid,
      displayName: resolvedName.length >= 2 ? resolvedName : 'CapeSafe Traveler',
      role: initialRole,
      requestedRole: resolvedRequestedRole,
      organization: resolvedOrg,
      location: 'Cape Town, Western Cape',
      ...(fbUser.photoURL ? { photoUrl: clampString(fbUser.photoURL, 500) } : {}),
      accessibilityPriority: Boolean(resolvedAccessibility),
      profileVisibility: 'public_guides' as ProfileVisibility,
      shareLocationConsent: false,
      aiContextPersonalization: true,
      preferredLanguage: 'English' as PreferredLanguage,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(userDocRef, baseProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }

    // If bootstrap admin email, elevate role in second step using isBootstrapAdmin()
    let finalRole: UserRole = initialRole;
    if (fbUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) {
      try {
        await updateDoc(userDocRef, {
          role: 'admin',
          requestedRole: 'admin',
          organization: 'Cape Town Tourism Operations',
          updatedAt: serverTimestamp(),
        });
        finalRole = 'admin';
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }
    }

    try {
      await setDoc(privateDocRef, {
        uid: fbUser.uid,
        email: clampString(fbUser.email || 'user@capesafe.app', 160),
        emergencyContact: '+27 21 555 0100',
        passId: `CS360-${fbUser.uid.slice(0, 6).toUpperCase()}`,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, privatePath);
    }

    clearPendingProfileDraft(fbUser.uid);

    return {
      id: fbUser.uid,
      name: baseProfile.displayName,
      email: fbUser.email || '',
      role: finalRole,
      requestedRole: resolvedRequestedRole,
      roleTitle: ROLE_LABELS[finalRole].label,
      organization: finalRole === 'admin' ? 'Cape Town Tourism Operations' : resolvedOrg,
      location: 'Cape Town, Western Cape',
      avatarUrl: fbUser.photoURL || undefined,
      passId: `CS360-${fbUser.uid.slice(0, 6).toUpperCase()}`,
      emergencyContact: '+27 21 555 0100',
      accessibilityPriority: Boolean(resolvedAccessibility),
      profileVisibility: 'public_guides',
      shareLocationConsent: false,
      aiContextPersonalization: true,
      preferredLanguage: 'English',
      emailVerified: true,
      authMode: 'firebase',
      dataOrigin: 'live',
    };
  }

  const data = userSnap.data() as {
    displayName?: string;
    role?: UserRole;
    requestedRole?: UserRole;
    organization?: string;
    location?: string;
    photoUrl?: string;
    accessibilityPriority?: boolean;
    profileVisibility?: ProfileVisibility;
    shareLocationConsent?: boolean;
    aiContextPersonalization?: boolean;
    preferredLanguage?: PreferredLanguage;
  };

  let privateData: { email?: string; emergencyContact?: string; passId?: string } = {};
  try {
    const privateSnap = await getDoc(privateDocRef);
    if (privateSnap.exists()) {
      privateData = privateSnap.data() as typeof privateData;
    } else {
      await setDoc(privateDocRef, {
        uid: fbUser.uid,
        email: clampString(fbUser.email || 'user@capesafe.app', 160),
        emergencyContact: '+27 21 555 0100',
        passId: `CS360-${fbUser.uid.slice(0, 6).toUpperCase()}`,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, privatePath);
  }

  clearPendingProfileDraft(fbUser.uid);

  const effectiveRole: UserRole =
    data.role && ['tourist', 'admin', 'provider', 'safety'].includes(data.role)
      ? data.role
      : 'tourist';

  return {
    id: fbUser.uid,
    name: data.displayName || resolvedName,
    email: privateData.email || fbUser.email || '',
    role: effectiveRole,
    requestedRole: data.requestedRole || effectiveRole,
    roleTitle: ROLE_LABELS[effectiveRole].label,
    organization: data.organization || 'Independent Traveler',
    location: data.location || 'Cape Town, Western Cape',
    avatarUrl: data.photoUrl || fbUser.photoURL || undefined,
    passId: privateData.passId || `CS360-${fbUser.uid.slice(0, 6).toUpperCase()}`,
    emergencyContact: privateData.emergencyContact || '+27 21 555 0100',
    accessibilityPriority: Boolean(data.accessibilityPriority),
    profileVisibility:
      data.profileVisibility && ['public_guides', 'initials_only', 'private'].includes(data.profileVisibility)
        ? data.profileVisibility
        : 'public_guides',
    shareLocationConsent: Boolean(data.shareLocationConsent),
    aiContextPersonalization: data.aiContextPersonalization !== false,
    preferredLanguage:
      data.preferredLanguage && ['English', 'Afrikaans', 'isiXhosa'].includes(data.preferredLanguage)
        ? data.preferredLanguage
        : 'English',
    emailVerified: fbUser.emailVerified,
    authMode: 'firebase',
    dataOrigin: 'live',
  };
}

export const authService = {
  isLiveBackendConnected(): boolean {
    return isFirebaseConfigured();
  },

  subscribeToAuthChanges(callback: (user: DemoUser | null) => void): Unsubscribe {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        callback(null);
        return;
      }
      try {
        const profile = await syncOrFetchUserProfile(fbUser);
        callback(profile);
      } catch (err) {
        console.error('Failed to load Firestore user profile:', err);
        callback(null);
      }
    });
  },

  async signInWithRoleDemo(role: UserRole): Promise<AuthSessionResult> {
    const matched = DEMO_USERS.find((u) => u.role === role) ?? DEMO_USERS[0];
    return {
      user: { ...matched, authMode: 'demo', emailVerified: true },
      mode: 'demonstration',
      message: `Signed in to demonstration ${matched.roleTitle} workspace.`,
    };
  },

  async signInWithEmail(credentials: AuthCredentials): Promise<AuthSessionResult> {
    const cred = await signInWithEmailAndPassword(
      auth,
      credentials.email.trim(),
      credentials.password
    );
    const profile = await syncOrFetchUserProfile(cred.user);
    return {
      user: profile,
      mode: 'firebase',
      message: cred.user.emailVerified
        ? `Signed in as ${profile.name} (${profile.roleTitle}).`
        : 'Signed in. Please verify your email address to enable Firestore saves.',
    };
  },

  async signInWithGoogle(requestedRole: UserRole = 'tourist'): Promise<AuthSessionResult> {
    const cred = await signInWithPopup(auth, googleProvider);
    const profile = await syncOrFetchUserProfile(cred.user, requestedRole);
    return {
      user: profile,
      mode: 'firebase',
      message: `Signed in with Google as ${profile.name}.`,
    };
  },

  async registerAccount(payload: RegisterPayload): Promise<AuthSessionResult> {
    const cred = await createUserWithEmailAndPassword(
      auth,
      payload.email.trim(),
      payload.password
    );

    const displayName = clampString(payload.fullName, 100);
    await updateProfile(cred.user, { displayName });

    savePendingProfileDraft(cred.user.uid, {
      displayName,
      requestedRole: payload.role,
      organization: payload.organization?.trim() || ROLE_LABELS[payload.role].label,
      accessibilityPriority: Boolean(payload.accessibilityPriority),
    });

    try {
      await sendEmailVerification(cred.user);
    } catch {
      // Verification dispatch failure should not crash registration
    }

    const profile = await syncOrFetchUserProfile(
      cred.user,
      payload.role,
      displayName,
      payload.organization,
      payload.accessibilityPriority
    );

    return {
      user: profile,
      mode: 'firebase',
      message:
        'Account created. Check your inbox for the verification email to unlock cloud Firestore persistence.',
    };
  },

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email.trim());
  },

  async resendVerificationEmail(): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('No active user session found.');
    }
    await sendEmailVerification(auth.currentUser);
  },

  async refreshVerificationStatus(): Promise<DemoUser | null> {
    if (!auth.currentUser) return null;
    await reload(auth.currentUser);
    return syncOrFetchUserProfile(auth.currentUser);
  },

  async signOutFirebase(): Promise<void> {
    await signOut(auth);
  },
};
