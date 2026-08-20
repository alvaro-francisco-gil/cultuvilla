import { BlockedUserDataSchema } from '../../models/user/BlockedUserDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const blockedUserConverterClient = makeConverter(BlockedUserDataSchema, clientSdkCtors);
