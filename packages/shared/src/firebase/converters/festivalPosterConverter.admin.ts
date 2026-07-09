import { FestivalPosterDataSchema } from '../../models/festivalPoster/FestivalPosterDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const festivalPosterConverterAdmin = makeConverter(FestivalPosterDataSchema, adminSdkCtors);
