import { ScrollView, View } from 'react-native';
import { HStack, Text } from '../../primitives';
import { ProfileHeader } from './ProfileHeader';
import { ProfileSectionHeader } from './ProfileSectionHeader';
import { useT } from '../../../lib/i18n';
import { buildDisplayName } from '@cultuvilla/shared/models/person';
import { isCatalogOccupation, occupationI18nKey } from '@cultuvilla/shared/models/occupation';
import type { PersonData } from '@cultuvilla/shared/models/person';

export interface PersonProfileViewProps {
  person: PersonData & { id: string };
}

/**
 * Read-only display of a single person (a dependent persona with no user
 * account). Reached when a non-owner opens the person screen — village admins
 * included — so it deliberately renders no edit affordances. Account-holder
 * vecinos route to the richer `/user/[uid]` profile instead.
 */
export function PersonProfileView({ person }: PersonProfileViewProps) {
  const { t } = useT();
  const occupations = person.occupations ?? [];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <ProfileHeader person={person} fallbackName={buildDisplayName(person)} />

      {person.biography ? (
        <>
          <ProfileSectionHeader title={t('profile.biography')} />
          <View className="px-4">
            <Text>{person.biography}</Text>
          </View>
        </>
      ) : null}

      {occupations.length > 0 ? (
        <>
          <ProfileSectionHeader title={t('occupations.picker.label')} />
          <HStack gap={2} className="px-4 flex-wrap">
            {occupations.map((o) => (
              <View
                key={o}
                className="bg-subtle rounded-full"
                style={{ paddingVertical: 6, paddingHorizontal: 14 }}
              >
                <Text variant="bodySm">
                  {isCatalogOccupation(o) ? t(occupationI18nKey(o)) : o}
                </Text>
              </View>
            ))}
          </HStack>
        </>
      ) : null}
    </ScrollView>
  );
}
