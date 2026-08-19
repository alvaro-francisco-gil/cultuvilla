import { useState } from 'react';
import { Modal, Pressable as RNPressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, iconSizes } from '@cultuvilla/shared/design-system';
import { Text } from './Text';
import { VStack } from './VStack';
import { Pressable } from './Pressable';
import { useT } from '../../lib/i18n';

const MUTED = colors.light.fg.muted;

export interface InfoTooltipProps {
  /** The explanation shown when the icon is tapped. */
  text: string;
  /** Heading of the popover — usually the label of the field it explains. */
  title?: string;
  testID?: string;
}

// An "ⓘ" affordance that parks a field's explanation behind a tap instead of
// spending a paragraph of the form on it. Long help text inline pushes the
// controls it describes below the fold — especially inside a stepper, where
// every step should read as a short list of decisions.
//
// The popover is a transparent Modal rather than an absolutely-positioned view
// so it escapes the parent ScrollView's clipping; the backdrop uses
// absoluteFill because RN-Web's Modal doesn't flex-fill its child (see
// the mobile-web-compat skill).
export function InfoTooltip({ text, title, testID }: InfoTooltipProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={title ? `${t('common.moreInfo')}: ${title}` : t('common.moreInfo')}
        hitSlop={8}
        testID={testID}
      >
        <Ionicons name="information-circle-outline" size={iconSizes.md} color={MUTED} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <RNPressable
          onPress={() => setOpen(false)}
          accessibilityLabel={t('common.close')}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
          ]}
        >
          {/* Swallows the tap so pressing the card itself doesn't dismiss it. */}
          <RNPressable
            onPress={() => {}}
            className="w-full max-w-md rounded-2xl border border-subtle bg-surface-elevated p-5"
          >
            <VStack gap={2}>
              {title ? <Text variant="h3">{title}</Text> : null}
              <Text tone="muted">{text}</Text>
              <View className="items-end pt-1">
                <Pressable
                  onPress={() => setOpen(false)}
                  accessibilityRole="button"
                  testID={testID ? `${testID}-close` : undefined}
                  hitSlop={8}
                >
                  <Text tone="primary" className="font-medium">{t('common.close')}</Text>
                </Pressable>
              </View>
            </VStack>
          </RNPressable>
        </RNPressable>
      </Modal>
    </>
  );
}
