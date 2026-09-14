import { NotificationPrefsDataSchema } from '../../models/notification/NotificationPrefsDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const notificationPrefsConverterClient = makeConverter(NotificationPrefsDataSchema, clientSdkCtors);
