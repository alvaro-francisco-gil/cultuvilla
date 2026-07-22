import { MunicipalityPersonDataSchema } from '../../models/municipality/MunicipalityPersonDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const municipalityPersonConverterAdmin = makeConverter(MunicipalityPersonDataSchema, adminSdkCtors);
