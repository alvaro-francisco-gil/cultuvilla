import { HistoryEntryDataSchema } from '../../models/history/HistoryEntryDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const historyEntryConverterClient = makeConverter(HistoryEntryDataSchema, clientSdkCtors);
