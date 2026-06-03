import { BarrioDataSchema } from '../../models/municipality/MunicipalityDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const barrioConverterAdmin = makeConverter(BarrioDataSchema, adminSdkCtors);
