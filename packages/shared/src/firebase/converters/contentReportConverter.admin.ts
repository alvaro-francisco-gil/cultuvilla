import { ContentReportDataSchema } from '../../models/moderation/ContentReportDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const contentReportConverterAdmin = makeConverter(ContentReportDataSchema, adminSdkCtors);
