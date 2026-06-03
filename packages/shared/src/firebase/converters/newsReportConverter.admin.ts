import { NewsReportDataSchema } from '../../models/news/NewsReportDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const newsReportConverterAdmin = makeConverter(NewsReportDataSchema, adminSdkCtors);
