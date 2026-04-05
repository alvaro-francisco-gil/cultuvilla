// Models
export type { Event, EventRegistration } from "./models/event";
export type { UserProfile } from "./models/user";

// Firebase
export { app, auth, db, storage } from "./firebase/firebaseApp";

// Services
export {
  createEvent,
  getEvent,
  getEvents,
  updateEvent,
  deleteEvent,
} from "./services/eventService";
export {
  registerToEvent,
  unregisterFromEvent,
  getEventRegistrations,
} from "./services/registrationService";
export {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
} from "./services/userService";
