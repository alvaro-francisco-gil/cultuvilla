import { VocabularyTermDataSchema } from '../../models/vocabulary/VocabularyTermDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const vocabularyTermConverterClient = makeConverter(VocabularyTermDataSchema, clientSdkCtors);
