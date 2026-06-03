import { VillageMemberDataSchema } from '../../models/municipality/VillageMemberDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const villageMemberConverterClient = makeConverter(VillageMemberDataSchema, clientSdkCtors);
