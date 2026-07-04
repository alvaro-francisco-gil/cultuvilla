import { MembershipEventDataSchema } from '../../models/membership/MembershipEventDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const membershipEventConverterAdmin = makeConverter(
  MembershipEventDataSchema,
  adminSdkCtors,
);
