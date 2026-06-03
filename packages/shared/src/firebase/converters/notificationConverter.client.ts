import { NotificationDataSchema } from '../../models/notification/NotificationDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const notificationConverterClient = makeConverter(NotificationDataSchema, clientSdkCtors);
