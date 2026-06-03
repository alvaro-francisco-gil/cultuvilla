import { NewsPostDataSchema } from '../../models/news/NewsPostDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const newsPostConverterAdmin = makeConverter(NewsPostDataSchema, adminSdkCtors);
