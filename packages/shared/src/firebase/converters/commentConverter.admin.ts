import { CommentDataSchema } from '../../models/interaction/CommentDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const commentConverterAdmin = makeConverter(CommentDataSchema, adminSdkCtors);
