import { SeatTokenDataSchema } from '../../models/event/SeatTokenModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const seatTokenConverterAdmin = makeConverter(SeatTokenDataSchema, adminSdkCtors);
