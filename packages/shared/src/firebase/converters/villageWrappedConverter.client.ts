import { WrappedDataSchema } from '../../models/wrapped/WrappedDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const villageWrappedConverterClient = makeConverter(WrappedDataSchema, clientSdkCtors);
