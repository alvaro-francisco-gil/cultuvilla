import { PersonDataSchema } from '../../models/person/PersonDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const personConverterClient = makeConverter(PersonDataSchema, clientSdkCtors);
export const personConverterAdmin = makeConverter(PersonDataSchema, adminSdkCtors);
