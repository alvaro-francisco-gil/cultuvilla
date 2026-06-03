import { EventDataSchema } from '../../models/event/EventDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const eventConverterClient = makeConverter(EventDataSchema, clientSdkCtors);
