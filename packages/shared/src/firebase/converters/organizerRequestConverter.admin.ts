import { OrganizerRequestDataSchema } from '../../models/municipality/OrganizerRequestDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const organizerRequestConverterAdmin = makeConverter(
  OrganizerRequestDataSchema,
  adminSdkCtors,
);
