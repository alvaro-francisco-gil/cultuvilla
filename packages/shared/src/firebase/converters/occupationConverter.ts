import { OccupationDataSchema } from '../../models/occupation/OccupationDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const occupationConverterClient = makeConverter(OccupationDataSchema, clientSdkCtors);
export const occupationConverterAdmin = makeConverter(OccupationDataSchema, adminSdkCtors);
