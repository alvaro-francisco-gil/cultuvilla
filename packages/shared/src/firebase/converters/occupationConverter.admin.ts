import { OccupationDataSchema } from '../../models/occupation/OccupationDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const occupationConverterAdmin = makeConverter(OccupationDataSchema, adminSdkCtors);
