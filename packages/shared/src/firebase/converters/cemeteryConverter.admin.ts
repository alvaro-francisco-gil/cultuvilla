import { CemeteryDataSchema } from '../../models/municipality/MunicipalityDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const cemeteryConverterAdmin = makeConverter(CemeteryDataSchema, adminSdkCtors);
