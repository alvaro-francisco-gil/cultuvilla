import { PushQueueDataSchema } from '../../models/notification/PushQueueDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const pushQueueConverterAdmin = makeConverter(PushQueueDataSchema, adminSdkCtors);
