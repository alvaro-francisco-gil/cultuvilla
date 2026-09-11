import { VocabularyWordDataSchema } from '../../models/vocabulary/VocabularyWordDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const vocabularyWordConverterClient = makeConverter(VocabularyWordDataSchema, clientSdkCtors);
