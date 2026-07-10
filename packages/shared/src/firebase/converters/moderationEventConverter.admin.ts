import { ModerationEventDataSchema } from '../../models/moderation/ModerationEventDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const moderationEventConverterAdmin = makeConverter(
  ModerationEventDataSchema,
  adminSdkCtors,
);
