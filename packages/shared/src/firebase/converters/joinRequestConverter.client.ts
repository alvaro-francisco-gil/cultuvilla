import { JoinRequestDataSchema } from '../../models/municipality/JoinRequestDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const joinRequestConverterClient = makeConverter(JoinRequestDataSchema, clientSdkCtors);
