import { OrgMemberDataSchema } from '../../models/organization/OrgMemberDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const orgMemberConverterAdmin = makeConverter(OrgMemberDataSchema, adminSdkCtors);
