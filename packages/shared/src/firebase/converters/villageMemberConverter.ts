import { VillageMemberDataSchema } from '../../models/municipality/VillageMemberDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const villageMemberConverterClient = makeConverter(VillageMemberDataSchema, clientSdkCtors);
export const villageMemberConverterAdmin = makeConverter(VillageMemberDataSchema, adminSdkCtors);
