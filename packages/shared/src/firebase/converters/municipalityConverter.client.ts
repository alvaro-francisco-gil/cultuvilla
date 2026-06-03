import { MunicipalityDataSchema } from '../../models/municipality/MunicipalityDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const municipalityConverterClient = makeConverter(MunicipalityDataSchema, clientSdkCtors);
