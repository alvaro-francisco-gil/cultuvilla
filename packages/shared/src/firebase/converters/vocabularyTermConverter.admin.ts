import { VocabularyTermDataSchema } from '../../models/vocabulary/VocabularyTermDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const vocabularyTermConverterAdmin = makeConverter(VocabularyTermDataSchema, adminSdkCtors);
