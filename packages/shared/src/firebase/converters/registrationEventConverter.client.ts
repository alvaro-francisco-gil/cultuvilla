import { RegistrationEventDataSchema } from '../../models/event/RegistrationEventDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const registrationEventConverterClient = makeConverter(
  RegistrationEventDataSchema,
  clientSdkCtors,
);
