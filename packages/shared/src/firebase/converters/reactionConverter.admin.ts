import { ReactionDataSchema } from '../../models/interaction/ReactionDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const reactionConverterAdmin = makeConverter(ReactionDataSchema, adminSdkCtors);
