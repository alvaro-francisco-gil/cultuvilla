import { OrganizerRequestDataSchema } from '../../models/municipality/OrganizerRequestDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const organizerRequestConverterClient = makeConverter(
  OrganizerRequestDataSchema,
  clientSdkCtors,
);
