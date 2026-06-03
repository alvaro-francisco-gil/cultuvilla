import { BarrioDataSchema } from '../../models/municipality/MunicipalityDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const barrioConverterClient = makeConverter(BarrioDataSchema, clientSdkCtors);
