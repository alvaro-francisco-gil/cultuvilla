import { NewsReactionDataSchema } from '../../models/news/NewsReactionDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const newsReactionConverterClient = makeConverter(NewsReactionDataSchema, clientSdkCtors);
