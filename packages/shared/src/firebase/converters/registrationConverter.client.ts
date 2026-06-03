import { RegistrationDataSchema } from '../../models/event/RegistrationDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const registrationConverterClient = makeConverter(RegistrationDataSchema, clientSdkCtors);
