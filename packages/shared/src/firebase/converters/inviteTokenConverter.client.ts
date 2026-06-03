import { InviteTokenDataSchema } from '../../models/municipality/InviteTokenDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const inviteTokenConverterClient = makeConverter(InviteTokenDataSchema, clientSdkCtors);
