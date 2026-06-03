import { CemeteryDataSchema } from '../../models/municipality/MunicipalityDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const cemeteryConverterClient = makeConverter(CemeteryDataSchema, clientSdkCtors);
