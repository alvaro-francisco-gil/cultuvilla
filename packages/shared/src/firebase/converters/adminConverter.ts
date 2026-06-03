import { AdminDataSchema } from '../../models/admin/AdminDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const adminConverterClient = makeConverter(AdminDataSchema, clientSdkCtors);
export const adminConverterAdmin = makeConverter(AdminDataSchema, adminSdkCtors);
