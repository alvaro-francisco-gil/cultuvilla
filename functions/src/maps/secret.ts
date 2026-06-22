import { defineSecret } from 'firebase-functions/params';

/** Google Maps Platform key — used by staticMap and geocodeSearch. Server-side only. */
export const GOOGLE_MAPS_API_KEY = defineSecret('GOOGLE_MAPS_API_KEY');
