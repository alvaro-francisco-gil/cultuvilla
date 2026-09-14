import { HistoryEntryDataSchema } from '../../models/history/HistoryEntryDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const historyEntryConverterAdmin = makeConverter(HistoryEntryDataSchema, adminSdkCtors);
