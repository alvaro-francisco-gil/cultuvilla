import { BlockedUserDataSchema } from '../../models/user/BlockedUserDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const blockedUserConverterAdmin = makeConverter(BlockedUserDataSchema, adminSdkCtors);
