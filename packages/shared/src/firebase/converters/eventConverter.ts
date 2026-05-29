import { EventDataSchema } from '../../models/event/EventDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const eventConverterClient = makeConverter(EventDataSchema, clientSdkCtors);
export const eventConverterAdmin = makeConverter(EventDataSchema, adminSdkCtors);
