import { MunicipalityPersonDataSchema } from '../../models/municipality/MunicipalityPersonDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const municipalityPersonConverterClient = makeConverter(MunicipalityPersonDataSchema, clientSdkCtors);
