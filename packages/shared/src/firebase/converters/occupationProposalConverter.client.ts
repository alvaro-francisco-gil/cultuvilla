import { OccupationProposalDataSchema } from '../../models/occupation/OccupationDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const occupationProposalConverterClient = makeConverter(
  OccupationProposalDataSchema,
  clientSdkCtors,
);
