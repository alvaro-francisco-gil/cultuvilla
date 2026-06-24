import { useState } from 'react';
import { Screen, VillagePicker, BarrioPicker } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { PersonForm } from '../../components/feature/PersonForm';
import type { PersonFormPhoto, PersonFormValues } from '../../components/feature/PersonForm';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import {
  createPerson,
  updatePerson,
  getPersonByUserId,
} from '@cultuvilla/shared/services/personService';
import {
  createUserProfile,
  patchUserProfile,
} from '@cultuvilla/shared/services/userService';
import { updateVillageMemberBarrio } from '@cultuvilla/shared/services/villageMemberService';
import { uploadUserPhoto } from '@cultuvilla/shared/services/imageService';
import { buildResidenceLinks } from '@cultuvilla/shared/models/person';
import type { MunicipalityLink, PartialDate } from '@cultuvilla/shared/models/person';

function toPartialDate(d: Date | null): PartialDate | null {
  if (!d) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export default function CompleteProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Onboarding residence: a single village (defaulting to the one just joined)
  // plus its barrio. The village is rarely changed here but stays editable.
  const [municipalityId, setMunicipalityId] = useState<string | null>(
    profile?.activeMunicipalityId ?? null,
  );
  const [barrioId, setBarrioId] = useState<string | null>(null);

  function handleVillageChange(id: string | null) {
    setMunicipalityId(id);
    setBarrioId(null);
  }

  async function onSubmit(values: PersonFormValues, photo: PersonFormPhoto | null) {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      const birthPlaceLink: MunicipalityLink | null = values.birthPlaceMunicipalityId
        ? { municipalityId: values.birthPlaceMunicipalityId, barrioId: null }
        : null;
      const municipalityLinks = buildResidenceLinks(municipalityId, barrioId);

      let personId: string;
      if (profile?.personId) {
        personId = profile.personId;
      } else {
        const existing = await getPersonByUserId(user.uid);
        personId = existing
          ? existing.id
          : await createPerson({
              givenName: values.givenName.trim(),
              firstSurname: values.firstSurname.trim() || null,
              secondSurname: values.secondSurname.trim() || null,
              nickname: values.nickname.trim() || null,
              sex: values.sex,
              birthday: toPartialDate(values.birthday),
              birthPlace: birthPlaceLink,
              municipalityLinks,
              biography: values.biography.trim() || null,
              userId: user.uid,
              createdBy: user.uid,
            });
      }

      // Record the barrio on the membership too (the editable source of truth).
      // Best-effort: a user without a membership for this village just keeps the
      // link written above; the sync trigger reconciles to the same value.
      if (municipalityId) {
        try {
          await updateVillageMemberBarrio(municipalityId, user.uid, barrioId);
        } catch {
          /* no membership yet — the link above already covers residence */
        }
      }

      if (photo) {
        const url = await uploadUserPhoto(user.uid, {
          blob: photo.blob,
          filename: `avatar-${Date.now()}.jpg`,
          contentType: photo.blob.type || 'image/jpeg',
        });
        await updatePerson(personId, { photoURL: url });
      }

      const profilePatch = {
        activeMunicipalityId: municipalityId,
        personId,
      };
      if (profile) {
        await patchUserProfile(user.uid, profilePatch);
      } else {
        await createUserProfile(user.uid, { email: user.email ?? '', ...profilePatch });
      }
      await refreshProfile();
      // AuthGate (_layout.tsx) owns post-onboarding routing.
    } catch (e) {
      setError(e instanceof Error ? e.message : t('onboarding.completeProfile.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen padded={false} bottomInset={false} topInset={false}>
      <ScreenHeader accent hideBack title={t('onboarding.completeProfile.title')} />
      <PersonForm
        requireFullName
        submitLabel={t('onboarding.completeProfile.submit')}
        loading={loading}
        error={error}
        renderResidence={() => (
          <>
            <VillagePicker
              label={t('profile.personForm.village')}
              value={municipalityId}
              onChange={handleVillageChange}
            />
            <BarrioPicker
              label={t('profile.personForm.barrio')}
              municipalityId={municipalityId}
              value={barrioId}
              onChange={setBarrioId}
              wholeVillageLabel={t('profile.personForm.wholeVillage')}
            />
          </>
        )}
        onSubmit={onSubmit}
      />
    </Screen>
  );
}
