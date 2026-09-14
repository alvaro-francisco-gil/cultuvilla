import { VocabularyDefinitionDataSchema } from '../../models/vocabulary/VocabularyDefinitionDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const vocabularyDefinitionConverterClient = makeConverter(VocabularyDefinitionDataSchema, clientSdkCtors);
