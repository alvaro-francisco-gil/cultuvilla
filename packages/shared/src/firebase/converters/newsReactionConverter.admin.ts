import { NewsReactionDataSchema } from '../../models/news/NewsReactionDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const newsReactionConverterAdmin = makeConverter(NewsReactionDataSchema, adminSdkCtors);
