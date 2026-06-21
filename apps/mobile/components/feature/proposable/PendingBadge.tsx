import { View } from 'react-native';
import { Text } from '../../primitives';
import { useT } from '../../../lib/i18n';

/** Small "pending review" pill shown on a proposal awaiting an organizer's decision. */
export function PendingBadge() {
  const { t } = useT();
  return (
    <View testID="pending-badge" className="px-2 py-0.5 rounded-full bg-amber-100 self-start">
      <Text variant="caption" className="text-amber-800">
        {t('village.proposals.pending')}
      </Text>
    </View>
  );
}
