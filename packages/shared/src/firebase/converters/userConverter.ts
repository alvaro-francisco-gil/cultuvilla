import { UserDataSchema } from '../../models/user/UserDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const userConverterClient = makeConverter(UserDataSchema, clientSdkCtors);
export const userConverterAdmin = makeConverter(UserDataSchema, adminSdkCtors);
