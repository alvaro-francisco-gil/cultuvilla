import { defineSecret } from 'firebase-functions/params';

/** Resend API key (send-only) — used to deliver branded auth sign-in emails. Server-side only. */
export const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
