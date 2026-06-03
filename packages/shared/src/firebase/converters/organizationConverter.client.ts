import { OrganizationDataSchema } from '../../models/organization/OrganizationDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const organizationConverterClient = makeConverter(OrganizationDataSchema, clientSdkCtors);
