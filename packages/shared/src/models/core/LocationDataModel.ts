import { z } from 'zod';

export const LatLngSchema = z.object({ lat: z.number(), lng: z.number() });
export type LatLng = z.infer<typeof LatLngSchema>;

export const LocationDataSchema = z.object({
  coordinates: LatLngSchema,
  displayName: z.string(),
});
export type LocationData = z.infer<typeof LocationDataSchema>;

export interface LocationDataInput {
  coordinates: LatLng;
  displayName: string;
}

export function buildLocationData(input: LocationDataInput): LocationData {
  return { coordinates: input.coordinates, displayName: input.displayName };
}
