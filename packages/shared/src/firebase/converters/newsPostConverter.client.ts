import { NewsPostDataSchema } from '../../models/news/NewsPostDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const newsPostConverterClient = makeConverter(NewsPostDataSchema, clientSdkCtors);
