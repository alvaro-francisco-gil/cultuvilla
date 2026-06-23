import { OrganizationJoinRequestDataSchema } from '../../models/organizationJoinRequest/OrganizationJoinRequestDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const organizationJoinRequestConverterClient = makeConverter(OrganizationJoinRequestDataSchema, clientSdkCtors);
