import { UserDataSchema } from '../../models/user/UserDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const userConverterAdmin = makeConverter(UserDataSchema, adminSdkCtors);
