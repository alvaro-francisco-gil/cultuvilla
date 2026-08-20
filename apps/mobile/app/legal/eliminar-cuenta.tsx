import { LegalDocScreen } from '../../components/feature/LegalDocScreen';
import { LEGAL_DOCS } from '../../lib/legal/content';

export default function AccountDeletionScreen() {
  return <LegalDocScreen doc={LEGAL_DOCS.accountDeletion} />;
}
