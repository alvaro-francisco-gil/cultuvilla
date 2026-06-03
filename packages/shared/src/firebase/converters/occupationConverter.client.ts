import { OccupationDataSchema } from '../../models/occupation/OccupationDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const occupationConverterClient = makeConverter(OccupationDataSchema, clientSdkCtors);
