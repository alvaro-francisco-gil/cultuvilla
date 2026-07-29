import { ScrollView, View } from 'react-native';
import { Text } from '../../primitives';
import { ProfileHeader } from './ProfileHeader';
import { ProfileSectionHeader } from './ProfileSectionHeader';
import { PersonInfobox, type PersonInfoboxRow } from './PersonInfobox';
import { useT } from '../../../lib/i18n';
import { usePersonPlaces } from '../../../lib/usePersonPlaces';
import { buildDisplayName } from '@cultuvilla/shared/models/person';
import { isCatalogOccupation, occupationI18nKey } from '@cultuvilla/shared/models/occupation';
import type { PersonData } from '@cultuvilla/shared/models/person';

export interface PersonProfileViewProps {
  person: PersonData & { id: string };
}

/**
 * Read-only display of a single person (a dependent persona with no user
 * account). Reached from the village tab — the roster, a barrio, an event's
 * attendee list — including by the persona's own creator, so it deliberately
 * renders no edit affordances. Account-holder vecinos route to the richer
 * `/user/[uid]` profile instead.
 *
 * Birthplace, pueblo and oficios share one Wikipedia-style infobox rather than
 * a headed section each: they are all short single-line facts, and one table
 * reads faster on a phone than three blocks with their own titles.
 */
export function PersonProfileView({ person }: PersonProfileViewProps) {
  const { t } = useT();
  const { birthPlace, residences } = usePersonPlaces(person);
  const occupations = person.occupations ?? [];

  const rows: PersonInfoboxRow[] = [];
  if (birthPlace) rows.push({ label: t('profile.personInfo.birthPlace'), value: birthPlace });
  if (residences.length > 0) {
    rows.push({ label: t('profile.personInfo.village'), value: residences.join(', ') });
  }
  if (occupations.length > 0) {
    rows.push({
      label: t('profile.personInfo.occupations'),
      value: occupations
        .map((o) => (isCatalogOccupation(o) ? t(occupationI18nKey(o)) : o))
        .join(', '),
    });
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <ProfileHeader person={person} fallbackName={buildDisplayName(person)} />

      <PersonInfobox rows={rows} />

      {person.biography ? (
        <>
          <ProfileSectionHeader title={t('profile.biography')} />
          <View className="px-4">
            <Text>{person.biography}</Text>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}
