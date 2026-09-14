import { WrappedDataSchema } from '../../models/wrapped/WrappedDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const villageWrappedConverterAdmin = makeConverter(WrappedDataSchema, adminSdkCtors);
