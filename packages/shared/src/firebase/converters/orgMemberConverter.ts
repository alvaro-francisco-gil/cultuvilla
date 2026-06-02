import { OrgMemberDataSchema } from '../../models/organization/OrgMemberDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const orgMemberConverterClient = makeConverter(OrgMemberDataSchema, clientSdkCtors);
export const orgMemberConverterAdmin = makeConverter(OrgMemberDataSchema, adminSdkCtors);
