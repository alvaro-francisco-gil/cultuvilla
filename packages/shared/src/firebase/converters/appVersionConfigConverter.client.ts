import { AppVersionConfigSchema } from '../../models/config';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const appVersionConfigConverterClient = makeConverter(AppVersionConfigSchema, clientSdkCtors);
