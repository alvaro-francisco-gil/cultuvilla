import { InviteTokenDataSchema } from '../../models/municipality/InviteTokenDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const inviteTokenConverterClient = makeConverter(InviteTokenDataSchema, clientSdkCtors);
export const inviteTokenConverterAdmin = makeConverter(InviteTokenDataSchema, adminSdkCtors);
