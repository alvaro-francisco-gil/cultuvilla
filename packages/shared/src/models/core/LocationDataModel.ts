import { z } from 'zod';

export const LocationTypeSchema = z.enum(['coordinates', 'text']);
export type LocationType = z.infer<typeof LocationTypeSchema>;

export const LatLngSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});
export type LatLng = z.infer<typeof LatLngSchema>;

export const LocationDataSchema = z.object({
  type: LocationTypeSchema,
  coordinates: LatLngSchema.nullable(),
  text: z.string().nullable(),
});
export type LocationData = z.infer<typeof LocationDataSchema>;

export interface LocationDataInput {
  type?: LocationType;
  coordinates?: LatLng | null;
  text?: string | null;
}

export function buildLocationData(input: LocationDataInput = {}): LocationData {
  const type = input.type ?? 'text';
  return {
    type,
    coordinates: type === 'coordinates' ? (input.coordinates ?? null) : null,
    text: type === 'text' ? (input.text ?? null) : null,
  };
}
