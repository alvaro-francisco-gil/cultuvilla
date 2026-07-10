import { ReactionDataSchema } from '../../models/interaction/ReactionDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const reactionConverterClient = makeConverter(ReactionDataSchema, clientSdkCtors);
