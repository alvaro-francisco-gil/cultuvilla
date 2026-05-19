export { app, auth, db, storage, functions } from "./firebaseApp";

// Re-export selected Firebase SDK symbols so apps never need to import from
// `firebase/*` directly (see AGENTS.md: service-layer ownership rule).
// Apps should import these from `@cultuvilla/shared/firebase`.
export { GeoPoint, Timestamp } from "firebase/firestore";
export type { User } from "firebase/auth";
