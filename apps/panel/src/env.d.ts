interface ImportMetaEnv {
  readonly FIREBASE_API_KEY_DEV?: string;
  readonly FIREBASE_AUTH_DOMAIN_DEV?: string;
  readonly FIREBASE_PROJECT_ID_DEV?: string;
  readonly FIREBASE_APP_ID_DEV?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
