import { OrganizationJoinRequestDataSchema } from '../../models/organizationJoinRequest/OrganizationJoinRequestDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const organizationJoinRequestConverterAdmin = makeConverter(OrganizationJoinRequestDataSchema, adminSdkCtors);
