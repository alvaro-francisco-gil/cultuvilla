// Single source of truth for the app-download landing (/descarga).
// Flip APP_AVAILABLE to true and fill APP_STORES the day the native apps ship.
export const APP_AVAILABLE = false;

export const APP_STORES: { ios: string; android: string } = {
  ios: '', // App Store URL — fill at release
  android: '', // Play Store URL — fill at release
};

// Must match `scheme` in apps/mobile/app.config.ts. Used to attempt opening an
// already-installed app before falling back to the store.
export const APP_SCHEME = 'cultuvilla';
