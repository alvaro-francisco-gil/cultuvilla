import { UserDataSchema } from '../../models/user/UserDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const userConverterClient = makeConverter(UserDataSchema, clientSdkCtors);
