import { useRef, useState } from 'react';
import { useLocalSearchParams, Redirect, router } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { Stepper, type StepConfig } from '../../../components/feature/Stepper';
import {
  CommunitySettingsEditor,
  type CommunitySettingsEditorHandle,
} from '../../../components/feature/CommunitySettingsEditor';
import { VillageContentManager } from '../../../components/feature/proposable/VillageContentManager';
import { MembersList } from '../../../components/feature/MembersList';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { useT } from '../../../lib/i18n';

// Role-mode community editor (organizers only; non-organizers are redirected
// back to the village, where the header is their read view). A two-step flow
// mirroring the person-creation Stepper: "Detalles" (escudo/description/
// location, which saves itself) → "Contenido" (moderate lugares/barrios/
// agrupaciones). The final step's button just closes the editor.
export default function CommunityScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { canManage, loading } = useEntityCapabilities(villageId);
  const { t } = useT();
  const editorRef = useRef<CommunitySettingsEditorHandle>(null);
  const [saving, setSaving] = useState(false);

  if (!villageId) return null;
  if (loading) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={t('village.edit.title')} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }
  if (!canManage) return <Redirect href={`/village/${villageId}`} />;

  // The final "Listo" button persists the Detalles step (escudo saves itself on
  // pick) and closes the editor.
  async function finish() {
    setSaving(true);
    try {
      await editorRef.current?.save();
    } finally {
      setSaving(false);
    }
    router.back();
  }

  const steps: StepConfig[] = [
    {
      key: 'details',
      title: t('village.edit.tabDetails'),
      icon: 'create-outline',
      render: () => <CommunitySettingsEditor ref={editorRef} villageId={villageId} />,
    },
    {
      key: 'content',
      title: t('village.edit.tabContent'),
      icon: 'list-outline',
      render: () => <VillageContentManager villageId={villageId} />,
    },
    {
      key: 'members',
      title: t('village.edit.tabMembers'),
      icon: 'people-outline',
      render: () => <MembersList villageId={villageId} />,
    },
  ];

  return (
    <Screen padded={false} topInset={false}>
      <ScreenHeader accent title={t('village.edit.title')} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Stepper steps={steps} onComplete={finish} submitLabel={t('common.done')} loading={saving} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
