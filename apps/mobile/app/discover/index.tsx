import { Screen } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { VillageDiscovery } from '../../components/feature/VillageDiscovery';
import { useT } from '../../lib/i18n';

// Standalone village-search screen. The Village tab embeds VillageDiscovery only
// when the user has no active village; once they've joined one, this route is the
// only way to reach the search (linked from the menu and the village switcher).
export default function DiscoverScreen() {
  const { t } = useT();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('discover.title')} />
      <VillageDiscovery />
    </Screen>
  );
}
