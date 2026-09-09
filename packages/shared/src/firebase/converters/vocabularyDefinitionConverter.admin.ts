import { VocabularyDefinitionDataSchema } from '../../models/vocabulary/VocabularyDefinitionDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const vocabularyDefinitionConverterAdmin = makeConverter(VocabularyDefinitionDataSchema, adminSdkCtors);
