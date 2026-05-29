import { MunicipalityDataSchema } from '../../models/municipality/MunicipalityDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const municipalityConverterClient = makeConverter(MunicipalityDataSchema, clientSdkCtors);
export const municipalityConverterAdmin = makeConverter(MunicipalityDataSchema, adminSdkCtors);
