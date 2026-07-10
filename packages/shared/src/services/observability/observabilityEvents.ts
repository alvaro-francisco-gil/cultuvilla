// Central event-name taxonomy. Web and native emit identical names.
// Convention: <domain>.<action>.<outcome>. Add a name here (never inline a
// string at a call site) and add it to the observability-conventions skill.
export const OBSERVABILITY_EVENTS = {
  ONBOARDING_STARTED: 'onboarding.start.begin',
  ONBOARDING_AGE_GATE: 'onboarding.age.gate',
  ONBOARDING_COMPLETED: 'onboarding.complete.success',
  VILLAGE_JOIN_SUCCESS: 'village.join.success',
  VILLAGE_JOIN_ERROR: 'village.join.error',
  EVENT_SIGNUP_SUCCESS: 'event.signup.success',
  EVENT_SIGNUP_ERROR: 'event.signup.error',
  ORG_CREATE_SUCCESS: 'org.create.success',
  ORG_CREATE_ERROR: 'org.create.error',
  APP_EXCEPTION: 'app.exception.thrown',
} as const;

export type ObservabilityEventName =
  (typeof OBSERVABILITY_EVENTS)[keyof typeof OBSERVABILITY_EVENTS];
