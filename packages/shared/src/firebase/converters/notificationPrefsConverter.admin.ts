import { NotificationPrefsDataSchema } from '../../models/notification/NotificationPrefsDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const notificationPrefsConverterAdmin = makeConverter(NotificationPrefsDataSchema, adminSdkCtors);
