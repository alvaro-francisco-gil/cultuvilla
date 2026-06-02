import { OccupationProposalDataSchema } from '../../models/occupation/OccupationDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const occupationProposalConverterClient = makeConverter(
  OccupationProposalDataSchema,
  clientSdkCtors,
);
export const occupationProposalConverterAdmin = makeConverter(
  OccupationProposalDataSchema,
  adminSdkCtors,
);
