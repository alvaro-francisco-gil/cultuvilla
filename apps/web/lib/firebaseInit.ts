// Side-effect module: initializes the shared Firebase singleton for the web
// app. Import this at the top of any entrypoint that may run before service
// calls (root layout, AuthContext, error reporter). `initFirebase` is
// idempotent, so re-imports are no-ops.
//
// Per-env config comes from `@cultuvilla/shared/config/environments` —
// keyed off `NEXT_PUBLIC_APP_ENV` (dev / beta / prod), which selects the
// `NEXT_PUBLIC_FIREBASE_*_<ENV>` env-var set.
import { initFirebase } from '@cultuvilla/shared/firebase';
import { getFirebaseConfig } from '@cultuvilla/shared/config/environments';

initFirebase(getFirebaseConfig(process.env.NEXT_PUBLIC_APP_ENV));
