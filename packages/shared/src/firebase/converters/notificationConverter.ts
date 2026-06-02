import { NotificationDataSchema } from '../../models/notification/NotificationDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const notificationConverterClient = makeConverter(NotificationDataSchema, clientSdkCtors);
export const notificationConverterAdmin = makeConverter(NotificationDataSchema, adminSdkCtors);
