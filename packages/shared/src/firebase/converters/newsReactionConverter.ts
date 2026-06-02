import { NewsReactionDataSchema } from '../../models/news/NewsReactionDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const newsReactionConverterClient = makeConverter(NewsReactionDataSchema, clientSdkCtors);
export const newsReactionConverterAdmin = makeConverter(NewsReactionDataSchema, adminSdkCtors);
