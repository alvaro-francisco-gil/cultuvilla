import { NewsReportDataSchema } from '../../models/news/NewsReportDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const newsReportConverterClient = makeConverter(NewsReportDataSchema, clientSdkCtors);
export const newsReportConverterAdmin = makeConverter(NewsReportDataSchema, adminSdkCtors);
