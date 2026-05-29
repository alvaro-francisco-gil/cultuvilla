import { RegistrationDataSchema } from '../../models/event/RegistrationDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const registrationConverterClient = makeConverter(RegistrationDataSchema, clientSdkCtors);
export const registrationConverterAdmin = makeConverter(RegistrationDataSchema, adminSdkCtors);
