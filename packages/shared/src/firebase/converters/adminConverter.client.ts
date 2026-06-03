import { AdminDataSchema } from '../../models/admin/AdminDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const adminConverterClient = makeConverter(AdminDataSchema, clientSdkCtors);
