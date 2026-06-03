import { OrgMemberDataSchema } from '../../models/organization/OrgMemberDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const orgMemberConverterClient = makeConverter(OrgMemberDataSchema, clientSdkCtors);
