import { MunicipalityDataSchema } from '../../models/municipality/MunicipalityDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const municipalityConverterAdmin = makeConverter(MunicipalityDataSchema, adminSdkCtors);
