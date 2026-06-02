import { OrganizerRequestDataSchema } from '../../models/municipality/OrganizerRequestDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const organizerRequestConverterClient = makeConverter(
  OrganizerRequestDataSchema,
  clientSdkCtors,
);
export const organizerRequestConverterAdmin = makeConverter(
  OrganizerRequestDataSchema,
  adminSdkCtors,
);
