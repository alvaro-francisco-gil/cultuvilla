import { RegistrationDataSchema } from '../../models/event/RegistrationDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const registrationConverterAdmin = makeConverter(RegistrationDataSchema, adminSdkCtors);
