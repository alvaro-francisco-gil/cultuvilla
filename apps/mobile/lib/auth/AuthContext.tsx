import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type { FirebaseOptions } from 'firebase/app';
import type { User } from 'firebase/auth';
import { getAuth } from '@cultuvilla/shared/firebase';
import { observability } from '@cultuvilla/shared';
import {
  signOut as fbSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  verifyBeforeUpdateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type ActionCodeSettings,
} from 'firebase/auth';
import {
  getUserProfile,
  setActiveMunicipality,
  patchUserProfile,
} from '@cultuvilla/shared/services/userService';
import { getUserMemberships } from '@cultuvilla/shared/services/villageMemberService';
import * as listenerManager from '@cultuvilla/shared/services/listenerManager';
import type { UserData } from '@cultuvilla/shared/models/user';
import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import { clearPendingIntent } from './pendingIntent';
import { fetchUserIdHash } from '../observability/errorBridge';

declare const __DEV__: boolean;

interface GoogleSignInExtra {
  webClientId: string;
  iosClientId: string;
}

interface DevAutoLogin {
  email: string;
  password: string;
}

// Dev-only convenience: skip the email-link round-trip on the emulator by
// signing straight into a seeded test account. app.config.ts only populates
// `extra.devAutoLogin` for `dev` builds when DEV_AUTOLOGIN_EMAIL/PASSWORD are
// set; the __DEV__ guard is a second backstop so this is impossible in a
// production bundle.
function getDevAutoLogin(): DevAutoLogin | null {
  if (!__DEV__) return null;
  const extra = Constants.expoConfig?.extra as { devAutoLogin?: DevAutoLogin | null } | undefined;
  const cfg = extra?.devAutoLogin;
  if (!cfg?.email || !cfg?.password) return null;
  return cfg;
}

function getGoogleSignInConfig(): GoogleSignInExtra | null {
  const extra = Constants.expoConfig?.extra as { googleSignIn?: GoogleSignInExtra } | undefined;
  const cfg = extra?.googleSignIn;
  if (!cfg?.webClientId) return null;
  return cfg;
}

// Firebase requires the continueUrl domain to be on Auth's "Authorized
// domains" list. The auto-hosted `*.firebaseapp.com` and `*.web.app` domains
// for the project are always authorized — derive the web SPA URL from
// authDomain so we don't have to maintain another env var.
const PENDING_EMAIL_KEY = 'cultuvilla.pendingEmailSignIn';

// Distinct key from PENDING_EMAIL_KEY: this stores a re-auth *intent* (what to
// do once the re-auth email link completes), not a sign-in email. The two
// flows can be in flight independently and must not clobber each other.
const PENDING_REAUTH_KEY = 'cultuvilla.pendingReauth';
const AUTH_EMAIL_LANGUAGE = 'es';

function getLocalizedAuth(): ReturnType<typeof getAuth> {
  const auth = getAuth();
  auth.languageCode = AUTH_EMAIL_LANGUAGE;
  return auth;
}

interface PendingReauthIntent {
  purpose: 'change-email';
  newEmail: string;
}

/**
 * Thrown by `changeEmail` when Firebase requires a fresh sign-in
 * (`auth/requires-recent-login`) before it will accept the email change. The
 * caller has already been sent a re-auth email link at this point; the
 * screen should show a "check your email" state and later call
 * `completeReauth` with the link the user taps.
 */
export class ReauthRequiredError extends Error {
  constructor() {
    super('reauth-required');
    this.name = 'ReauthRequiredError';
  }
}

/**
 * Thrown by `changeEmail` when the account is not email-only (e.g. it is
 * Google-linked). Change-email would desync the account from its federated
 * identity, so it is refused at the action layer as well as hidden in the UI.
 */
export class ChangeEmailNotAllowedError extends Error {
  constructor() {
    super('change-email-not-allowed');
    this.name = 'ChangeEmailNotAllowedError';
  }
}

/** True iff every sign-in provider is email-based (password / magic-link). */
function isEmailOnlyAccount(user: User | null): boolean {
  const providers = user?.providerData ?? [];
  return (
    providers.length > 0 &&
    providers.every((p) => p.providerId === 'password' || p.providerId === 'emailLink')
  );
}

function getEmailLinkContinueUrl(): string {
  const cfg = (Constants.expoConfig?.extra as { firebaseConfig?: FirebaseOptions } | undefined)
    ?.firebaseConfig;
  const authDomain = cfg?.authDomain;
  if (!authDomain) {
    throw new Error(
      '[cultuvilla] firebaseConfig.authDomain missing — cannot build email-link continueUrl',
    );
  }
  const host = authDomain.replace(/\.firebaseapp\.com$/, '.web.app');
  return `https://${host}/finish`;
}

type Profile = (UserData & { id: string }) | null;

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  profile: Profile;
  profileLoading: boolean;
  profileChecked: boolean;
  refreshProfile: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendEmailLink: (email: string) => Promise<void>;
  completeEmailLinkSignIn: (url: string, emailOverride?: string) => Promise<void>;
  isEmailLink: (url: string) => boolean;
  readPendingEmail: () => Promise<string | null>;
  changeEmail: (newEmail: string) => Promise<void>;
  completeReauth: (url: string) => Promise<void>;
  readPendingReauth: () => Promise<{ purpose: string; newEmail?: string } | null>;
  clearPendingReauth: () => Promise<void>;
  /**
   * True only when the account's identity IS its email (magic-link / password),
   * i.e. every sign-in provider is email-based. A Google-linked account's email
   * is its Google identity, so change-email is disabled for it.
   */
  canChangeEmail: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const googleConfigured = useRef(false);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) setProfileChecked(true);
    });
  }, []);

  // Dev auto sign-in: once the initial auth state has resolved to "signed
  // out", sign into the configured test account. Attempt-once-per-session so a
  // manual signOut() lets you exercise the guest flow without being yanked
  // straight back in — reload the app to re-trigger.
  const devAutoLoginAttempted = useRef(false);
  useEffect(() => {
    if (loading || user || devAutoLoginAttempted.current) return;
    const cfg = getDevAutoLogin();
    if (!cfg) return;
    devAutoLoginAttempted.current = true;
    void signInWithEmailAndPassword(getAuth(), cfg.email, cfg.password).catch((e) => {
      console.warn('[dev-autologin] sign-in failed:', e instanceof Error ? e.message : e);
    });
  }, [loading, user]);

  useEffect(() => {
    if (googleConfigured.current) return;
    if (Platform.OS === 'web') return;
    const cfg = getGoogleSignInConfig();
    if (!cfg) return;
    GoogleSignin.configure({
      webClientId: cfg.webClientId,
      iosClientId: cfg.iosClientId || undefined,
    });
    googleConfigured.current = true;
  }, []);

  // E2E fixture-login seam (web only). Exposed on `window.__cultuvillaE2E` so the
  // Playwright suite can sign in as a seeded fixture user without Google OAuth.
  // Guarded three independent ways so it can NEVER fire in a build a real user
  // could load:
  //   1. extra.useEmulator — the build-time USE_FIREBASE_EMULATOR flag, set only
  //      by the web-e2e CI job (deploy workflows positively assert it is unset).
  //   2. Platform.OS === 'web' — the only surface Playwright drives.
  //   3. a runtime assertion that Auth is actually pointed at a loopback emulator
  //      (getAuth().emulatorConfig.host). Even if the flag leaked, a build talking
  //      to real Firebase installs nothing — it fails closed by physics.
  // Uses the single signInWithEmailAndPassword primitive; no new auth method.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (Constants.expoConfig?.extra?.useEmulator !== true) return;
    const auth = getAuth();
    const host = auth.emulatorConfig?.host;
    if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') return;
    (globalThis as { __cultuvillaE2E?: unknown }).__cultuvillaE2E = {
      login: (email: string, password: string) =>
        signInWithEmailAndPassword(auth, email, password),
      signOut: () => fbSignOut(auth),
    };
  }, []);

  const loadProfile = useCallback(async (uid: string, currentEmail: string | null) => {
    setProfileLoading(true);
    try {
      const p = await getUserProfile(uid);
      setProfile(p);
      if (p) {
        // Defer setUserContext until the hashed uid resolves — never forward
        // the raw Firebase uid to Analytics. Re-check against the live auth
        // user at apply-time so a mid-fetch sign-out / account switch can't
        // stamp a stale (or now-wrong) user's hash onto the new session.
        void fetchUserIdHash(uid).then((hash) => {
          if (hash && getAuth().currentUser?.uid === uid) {
            observability.setUserContext({ uid: hash, municipalityId: p.activeMunicipalityId ?? undefined });
          }
        });
      }
      // Resume-time sync: Firebase Auth's email can change out from under the
      // Firestore profile (e.g. verifyBeforeUpdateEmail completes server-side
      // via the link, or a Google-linked account's email changes at Google).
      // The token's email is always the source of truth; the rules permit a
      // client email patch equal to it (Task 2).
      if (p && currentEmail && p.email !== currentEmail) {
        await patchUserProfile(uid, { email: currentEmail });
      }
    } finally {
      setProfileLoading(false);
      setProfileChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      observability.setUserContext(null);
      return;
    }
    setProfileChecked(false);
    setProfileLoading(true);
    loadProfile(user.uid, user.email);
  }, [user, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.uid, user.email);
  }, [user, loadProfile]);

  // Once the profile is loaded, if the user has no active village, pick their
  // first membership so the header reflects a real village instead of the
  // generic "Cultuvilla" fallback. Runs once per session per user.
  const activeSyncRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !profile) return;
    if (profile.activeMunicipalityId) return;
    if (activeSyncRef.current === user.uid) return;
    activeSyncRef.current = user.uid;
    void (async () => {
      const memberships = await getUserMemberships(user.uid);
      const first = memberships[0];
      if (!first) return;
      await setActiveMunicipality(user.uid, first.municipalityId);
      await loadProfile(user.uid, user.email);
    })();
  }, [user, profile, loadProfile]);

  const signInWithGoogle = async (): Promise<void> => {
    if (Platform.OS === 'web') {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(getAuth(), provider);
      return;
    }
    const cfg = getGoogleSignInConfig();
    if (!cfg) {
      throw new Error(
        'Google sign-in is not configured — set GOOGLE_WEB_CLIENT_ID_* in apps/mobile/.env',
      );
    }
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    try {
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        throw new Error('Google sign-in was cancelled');
      }
      const idToken = response.data.idToken;
      if (!idToken) {
        throw new Error('Google sign-in did not return an idToken');
      }
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(getAuth(), credential);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS) {
        throw new Error('Google sign-in was cancelled');
      }
      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services are not available on this device');
      }
      throw err;
    }
  };

  const sendEmailLink = async (email: string): Promise<void> => {
    const trimmed = email.trim();
    if (!trimmed) throw new Error('email-required');
    const settings: ActionCodeSettings = {
      url: getEmailLinkContinueUrl(),
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(getLocalizedAuth(), trimmed, settings);
    await AsyncStorage.setItem(PENDING_EMAIL_KEY, trimmed);
  };

  const completeEmailLinkSignIn = async (url: string, emailOverride?: string): Promise<void> => {
    const auth = getAuth();
    if (!isSignInWithEmailLink(auth, url)) {
      throw new Error('not-an-email-link');
    }
    const stored = emailOverride ?? (await AsyncStorage.getItem(PENDING_EMAIL_KEY));
    if (!stored) throw new Error('email-required');
    await signInWithEmailLink(auth, stored, url);
    await AsyncStorage.removeItem(PENDING_EMAIL_KEY);
  };

  const isEmailLink = (url: string): boolean => isSignInWithEmailLink(getAuth(), url);

  const readPendingEmail = async (): Promise<string | null> =>
    AsyncStorage.getItem(PENDING_EMAIL_KEY);

  const changeEmail = async (newEmail: string): Promise<void> => {
    const auth = getLocalizedAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('not-signed-in');
    // Defense in depth: the UI hides change-email for non-email-only accounts,
    // but the screen route is directly reachable on web — refuse here too.
    if (!isEmailOnlyAccount(currentUser)) throw new ChangeEmailNotAllowedError();
    const trimmed = newEmail.trim();
    if (!trimmed) throw new Error('email-required');
    try {
      await verifyBeforeUpdateEmail(currentUser, trimmed);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== 'auth/requires-recent-login') throw err;
      const currentEmail = currentUser.email;
      if (!currentEmail) throw err;
      const intent: PendingReauthIntent = { purpose: 'change-email', newEmail: trimmed };
      await AsyncStorage.setItem(PENDING_REAUTH_KEY, JSON.stringify(intent));
      const settings: ActionCodeSettings = {
        url: getEmailLinkContinueUrl(),
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, currentEmail, settings);
      throw new ReauthRequiredError();
    }
  };

  const completeReauth = async (url: string): Promise<void> => {
    const auth = getLocalizedAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      // The session lapsed between changeEmail() sending the re-auth link and
      // the user tapping it. Clear the stale intent so it can't wedge every
      // future email-link sign-in — see finish.tsx, which checks
      // readPendingReauth() before the normal sign-in path.
      await AsyncStorage.removeItem(PENDING_REAUTH_KEY);
      throw new Error('not-signed-in');
    }
    if (!isSignInWithEmailLink(auth, url)) throw new Error('not-an-email-link');
    const currentEmail = currentUser.email;
    if (!currentEmail) throw new Error('email-required');
    const credential = EmailAuthProvider.credentialWithLink(currentEmail, url);
    await reauthenticateWithCredential(currentUser, credential);
    const stored = await AsyncStorage.getItem(PENDING_REAUTH_KEY);
    if (stored) {
      const intent = JSON.parse(stored) as Partial<PendingReauthIntent>;
      if (intent.purpose === 'change-email' && intent.newEmail) {
        await verifyBeforeUpdateEmail(currentUser, intent.newEmail);
      }
      await AsyncStorage.removeItem(PENDING_REAUTH_KEY);
    }
  };

  const readPendingReauth = async (): Promise<{ purpose: string; newEmail?: string } | null> => {
    const stored = await AsyncStorage.getItem(PENDING_REAUTH_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as { purpose: string; newEmail?: string };
  };

  const clearPendingReauth = async (): Promise<void> => {
    await AsyncStorage.removeItem(PENDING_REAUTH_KEY);
  };

  // Change-email is only meaningful when the account's identity IS its email
  // (magic-link / password). If ANY federated provider (e.g. google.com) is
  // attached, the email is that identity's — changing it here would desync it —
  // so change-email is disabled unless every provider is email-based.
  const canChangeEmail = isEmailOnlyAccount(user);

  const signOut = async (): Promise<void> => {
    // Tear down every registered Firestore listener BEFORE auth flips closed,
    // so no listener fires a final permission-denied snapshot at the moment
    // the rules flip. See packages/shared/src/services/listenerManager.ts.
    await listenerManager.clearAll();
    if (googleConfigured.current) {
      try {
        await GoogleSignin.signOut();
      } catch {
        // Ignore — user may not have signed in with Google this session.
      }
    }
    await clearPendingIntent();
    await AsyncStorage.removeItem(PENDING_REAUTH_KEY);
    await fbSignOut(getAuth());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profile,
        profileLoading,
        profileChecked,
        refreshProfile,
        signInWithGoogle,
        sendEmailLink,
        completeEmailLinkSignIn,
        isEmailLink,
        readPendingEmail,
        changeEmail,
        completeReauth,
        readPendingReauth,
        clearPendingReauth,
        canChangeEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
