import { Screen, Text } from '../../components/primitives';
import { useT } from '../../lib/i18n';

export default function VillagesScreen() {
  const { t } = useT();
  return (
    <Screen>
      <Text variant="h2">{t('village.title')}</Text>
    </Screen>
  );
}
