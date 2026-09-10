import { DeviceTokenDataSchema } from '../../models/notification/DeviceTokenDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const deviceTokenConverterClient = makeConverter(DeviceTokenDataSchema, clientSdkCtors);
