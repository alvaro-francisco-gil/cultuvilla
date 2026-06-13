import { PlaceDataSchema } from '../../models/municipality/MunicipalityDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const placeConverterAdmin = makeConverter(PlaceDataSchema, adminSdkCtors);
