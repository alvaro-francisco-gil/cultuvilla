import { JoinRequestDataSchema } from '../../models/municipality/JoinRequestDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const joinRequestConverterClient = makeConverter(JoinRequestDataSchema, clientSdkCtors);
export const joinRequestConverterAdmin = makeConverter(JoinRequestDataSchema, adminSdkCtors);
