import { CemeteryDataSchema } from '../../models/municipality/MunicipalityDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const cemeteryConverterClient = makeConverter(CemeteryDataSchema, clientSdkCtors);
export const cemeteryConverterAdmin = makeConverter(CemeteryDataSchema, adminSdkCtors);
