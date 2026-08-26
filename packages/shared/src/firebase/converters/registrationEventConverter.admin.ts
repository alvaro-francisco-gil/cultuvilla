import { RegistrationEventDataSchema } from '../../models/event/RegistrationEventDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const registrationEventConverterAdmin = makeConverter(
  RegistrationEventDataSchema,
  adminSdkCtors,
);
