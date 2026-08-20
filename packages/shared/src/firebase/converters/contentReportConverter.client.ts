import { ContentReportDataSchema } from '../../models/moderation/ContentReportDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const contentReportConverterClient = makeConverter(ContentReportDataSchema, clientSdkCtors);
