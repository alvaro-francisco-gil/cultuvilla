import { JoinRequestDataSchema } from '../../models/municipality/JoinRequestDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const joinRequestConverterAdmin = makeConverter(JoinRequestDataSchema, adminSdkCtors);
