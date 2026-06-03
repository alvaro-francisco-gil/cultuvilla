import { PersonDataSchema } from '../../models/person/PersonDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const personConverterAdmin = makeConverter(PersonDataSchema, adminSdkCtors);
