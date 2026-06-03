import { EventDataSchema } from '../../models/event/EventDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const eventConverterAdmin = makeConverter(EventDataSchema, adminSdkCtors);
