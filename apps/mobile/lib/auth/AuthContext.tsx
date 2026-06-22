import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type { FirebaseOptions } from 'firebase/app';
import type { User } from 'firebase/auth';
import { getAuth } from '@cultuvilla/shared/firebase';
import {
  signOut as fbSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  type ActionCodeSettings,
} from 'firebase/auth';
import { getUserProfile, setActiveMunicipality } from '@cultuvilla/shared/services/userService';
import { getUserMemberships } from '@cultuvilla/shared/services/villageMemberService';
import * as listenerManager from '@cultuvilla/shared/services/listenerManager';
import type { UserData } from '@cultuvilla/shared/models/user';
import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import { clearPendingIntent } from './pendingIntent';

interface GoogleSignInExtra {
  webClientId: string;
  iosClientId: string;
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

  const loadProfile = useCallback(async (uid: string) => {
    setProfileLoading(true);
    try {
      const p = await getUserProfile(uid);
      setProfile(p);
    } finally {
      setProfileLoading(false);
      setProfileChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileChecked(false);
    setProfileLoading(true);
    loadProfile(user.uid);
  }, [user, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.uid);
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
      await loadProfile(user.uid);
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
    await sendSignInLinkToEmail(getAuth(), trimmed, settings);
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
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
