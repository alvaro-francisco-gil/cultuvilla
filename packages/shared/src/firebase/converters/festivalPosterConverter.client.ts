import { FestivalPosterDataSchema } from '../../models/festivalPoster/FestivalPosterDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const festivalPosterConverterClient = makeConverter(FestivalPosterDataSchema, clientSdkCtors);
