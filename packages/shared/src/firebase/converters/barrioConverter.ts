import { BarrioDataSchema } from '../../models/municipality/MunicipalityDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const barrioConverterClient = makeConverter(BarrioDataSchema, clientSdkCtors);
export const barrioConverterAdmin = makeConverter(BarrioDataSchema, adminSdkCtors);
