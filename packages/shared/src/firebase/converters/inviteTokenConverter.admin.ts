import { InviteTokenDataSchema } from '../../models/municipality/InviteTokenDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const inviteTokenConverterAdmin = makeConverter(InviteTokenDataSchema, adminSdkCtors);
