import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

/**
 * The panel runs against the **dev** project on purpose. Its data comes from git
 * rather than from an environment, and keeping it out of the production project
 * means a broken panel can never touch the app's release path.
 */
const config = {
  apiKey: import.meta.env.FIREBASE_API_KEY_DEV,
  authDomain: import.meta.env.FIREBASE_AUTH_DOMAIN_DEV,
  projectId: import.meta.env.FIREBASE_PROJECT_ID_DEV,
};

export const missingConfig = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key);

const app = initializeApp({ ...config, appId: import.meta.env.FIREBASE_APP_ID_DEV ?? '' });

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const functions = getFunctions(app, 'europe-west1');
