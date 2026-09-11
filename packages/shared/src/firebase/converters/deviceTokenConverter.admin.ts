import { DeviceTokenDataSchema } from '../../models/notification/DeviceTokenDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const deviceTokenConverterAdmin = makeConverter(DeviceTokenDataSchema, adminSdkCtors);
