import { OccupationProposalDataSchema } from '../../models/occupation/OccupationDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';

export const occupationProposalConverterAdmin = makeConverter(
  OccupationProposalDataSchema,
  adminSdkCtors,
);
