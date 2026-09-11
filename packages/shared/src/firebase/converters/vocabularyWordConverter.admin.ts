import { VocabularyWordDataSchema } from '../../models/vocabulary/VocabularyWordDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const vocabularyWordConverterAdmin = makeConverter(VocabularyWordDataSchema, adminSdkCtors);
