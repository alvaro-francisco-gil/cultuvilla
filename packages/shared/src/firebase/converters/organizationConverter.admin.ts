import { OrganizationDataSchema } from '../../models/organization/OrganizationDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const organizationConverterAdmin = makeConverter(OrganizationDataSchema, adminSdkCtors);
