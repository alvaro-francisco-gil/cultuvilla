import { CommentDataSchema } from '../../models/interaction/CommentDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const commentConverterClient = makeConverter(CommentDataSchema, clientSdkCtors);
