import { NotificationDataSchema } from '../../models/notification/NotificationDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const notificationConverterAdmin = makeConverter(NotificationDataSchema, adminSdkCtors);
