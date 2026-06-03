import { NewsReportDataSchema } from '../../models/news/NewsReportDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const newsReportConverterClient = makeConverter(NewsReportDataSchema, clientSdkCtors);
