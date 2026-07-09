import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useLocalSearchParams, Redirect, router } from 'expo-router';
import { Screen } from '../../../components/primitives/Screen';
import { Text } from '../../../components/primitives/Text';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { ProposableForm } from '../../../components/feature/proposable/ProposableForm';
import { useT } from '../../../lib/i18n';
import { useOrgCapabilities } from '../../../lib/auth/useOrgCapabilities';
import { getOrganization, updateOrganization } from '@cultuvilla/shared/services/organizationService';
import { uploadOrganizationImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import {
  PROPOSABLE_ORGANIZATION_TYPES,
  type OrganizationType,
} from '@cultuvilla/shared/models/organization/OrganizationDataModel';

export default function OrgEditScreen() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const { t } = useT();
  const [municipalityId, setMunicipalityId] = useState<string | undefined>(undefined);
  const { canManage, loading: capLoading } = useOrgCapabilities(orgId, municipalityId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<OrganizationType>('peña');
  const [existingImageUri, setExistingImageUri] = useState<string | null>(null);
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const typeLabel = (ty: OrganizationType) => t(`organization.${ty}` as never);

  useEffect(() => {
    if (!orgId) return;
    void (async () => {
      const o = await getOrganization(orgId);
      if (o) {
        setName(o.name);
        setDescription(o.description ?? '');
        setType(o.type);
        setExistingImageUri(o.imageURL ?? null);
        setMunicipalityId(o.municipalityId);
      } else {
        setNotFound(true);
      }
      setLoaded(true);
    })();
  }, [orgId]);

  if (capLoading || !loaded) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={t('organization.editTitle')} />
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      </Screen>
    );
  }
  if (notFound) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={t('organization.editTitle')} />
        <View className="flex-1 items-center justify-center"><Text>{t('common.notFound')}</Text></View>
      </Screen>
    );
  }
  if (!canManage) return <Redirect href={`/o/${orgId}`} />;

  async function submit() {
    if (!orgId || !name.trim()) return;
    setSaving(true);
    try {
      await updateOrganization(orgId, {
        name: name.trim(),
        description: description.trim() || null,
        type,
      });
      if (image) {
        const imageURL = await uploadOrganizationImage(orgId, image);
        await updateOrganization(orgId, { imageURL });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false} topInset={false}>
      <ScreenHeader accent title={t('organization.editTitle')} />
      <ScrollView contentContainerClassName="p-4">
        <ProposableForm
          image={image}
          onImageChange={setImage}
          existingImageUri={existingImageUri}
          imageLabels={{
            add: t('organization.addImage'),
            selected: t('organization.imageSelected'),
          }}
          name={name}
          onChangeName={setName}
          nameLabel={t('organization.name')}
          nameTestID="org-edit-name-input"
          description={description}
          onChangeDescription={setDescription}
          descriptionLabel={t('organization.description')}
          typeLabel={t('organization.type')}
          typeOptions={PROPOSABLE_ORGANIZATION_TYPES.map((ty) => ({ value: ty, label: typeLabel(ty) }))}
          typeValue={type}
          onChangeType={(v) => setType(v as OrganizationType)}
          submitLabel={t('common.save')}
          submitTestID="org-edit-submit"
          onSubmit={submit}
          saving={saving}
          disabled={!name.trim()}
        />
      </ScrollView>
    </Screen>
  );
}
