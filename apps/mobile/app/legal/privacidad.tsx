import { LegalDocScreen } from '../../components/feature/LegalDocScreen';
import { LEGAL_DOCS } from '../../lib/legal/content';

export default function PrivacyScreen() {
  return <LegalDocScreen doc={LEGAL_DOCS.privacy} />;
}
