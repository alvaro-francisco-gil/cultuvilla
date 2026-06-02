import { NewsPostDataSchema } from '../../models/news/NewsPostDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const newsPostConverterClient = makeConverter(NewsPostDataSchema, clientSdkCtors);
export const newsPostConverterAdmin = makeConverter(NewsPostDataSchema, adminSdkCtors);
