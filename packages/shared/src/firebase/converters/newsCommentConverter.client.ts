import { NewsCommentDataSchema } from '../../models/news/NewsCommentDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const newsCommentConverterClient = makeConverter(NewsCommentDataSchema, clientSdkCtors);
