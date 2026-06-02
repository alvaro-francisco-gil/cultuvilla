import { NewsCommentDataSchema } from '../../models/news/NewsCommentDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const newsCommentConverterClient = makeConverter(NewsCommentDataSchema, clientSdkCtors);
export const newsCommentConverterAdmin = makeConverter(NewsCommentDataSchema, adminSdkCtors);
