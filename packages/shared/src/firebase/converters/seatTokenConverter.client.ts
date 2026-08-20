import { SeatTokenDataSchema } from '../../models/event/SeatTokenModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const seatTokenConverterClient = makeConverter(SeatTokenDataSchema, clientSdkCtors);
