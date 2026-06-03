import { PersonDataSchema } from '../../models/person/PersonDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const personConverterClient = makeConverter(PersonDataSchema, clientSdkCtors);
