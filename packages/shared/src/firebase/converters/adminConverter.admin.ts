import { AdminDataSchema } from '../../models/admin/AdminDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const adminConverterAdmin = makeConverter(AdminDataSchema, adminSdkCtors);
