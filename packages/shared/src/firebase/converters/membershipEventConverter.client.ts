import { MembershipEventDataSchema } from '../../models/membership/MembershipEventDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const membershipEventConverterClient = makeConverter(
  MembershipEventDataSchema,
  clientSdkCtors,
);
