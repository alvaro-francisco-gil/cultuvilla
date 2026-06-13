import { PlaceDataSchema } from '../../models/municipality/MunicipalityDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const placeConverterClient = makeConverter(PlaceDataSchema, clientSdkCtors);
