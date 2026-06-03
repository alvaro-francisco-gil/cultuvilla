import { VillageMemberDataSchema } from '../../models/municipality/VillageMemberDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const villageMemberConverterAdmin = makeConverter(VillageMemberDataSchema, adminSdkCtors);
