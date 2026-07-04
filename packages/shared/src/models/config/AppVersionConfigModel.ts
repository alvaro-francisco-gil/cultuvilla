import { z } from 'zod';

const PlatformVersionsSchema = z.object({
  minSupported: z.string(),
  latest: z.string(),
});

export const AppVersionConfigSchema = z.object({
  ios: PlatformVersionsSchema,
  android: PlatformVersionsSchema,
  storeUrl: z.object({
    ios: z.string(),
    android: z.string(),
  }),
});
export type AppVersionConfig = z.infer<typeof AppVersionConfigSchema>;
