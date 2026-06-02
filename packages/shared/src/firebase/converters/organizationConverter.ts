import { OrganizationDataSchema } from '../../models/organization/OrganizationDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const organizationConverterClient = makeConverter(OrganizationDataSchema, clientSdkCtors);
export const organizationConverterAdmin = makeConverter(OrganizationDataSchema, adminSdkCtors);
