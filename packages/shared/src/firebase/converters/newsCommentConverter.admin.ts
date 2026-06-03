import { NewsCommentDataSchema } from '../../models/news/NewsCommentDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const newsCommentConverterAdmin = makeConverter(NewsCommentDataSchema, adminSdkCtors);
