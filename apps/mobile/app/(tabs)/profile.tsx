import { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { Screen, VStack, HStack, Text, Button } from '../../components/primitives';
import { AppHeader } from '../../components/layout/AppHeader';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { pickImageAsBlob } from '../../lib/images';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { uploadPersonImage } from '@cultuvilla/shared/services/imageService';
import { buildDisplayName } from '@cultuvilla/shared/models/person';
import type { PersonData } from '@cultuvilla/shared/models/person';

type PersonDoc = PersonData & { id: string };

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { t } = useT();
  const [person, setPerson] = useState<PersonDoc | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    getPersonByUserId(user.uid).then(setPerson);
  }, [user]);

  async function onChangePhoto() {
    if (!person) return;
    const picked = await pickImageAsBlob();
    if (!picked) return;
    setUploading(true);
    try {
      await uploadPersonImage(person.id, picked);
      const refreshed = await getPersonByUserId(user!.uid);
      setPerson(refreshed);
    } finally {
      setUploading(false);
    }
  }

  if (!user) return null;

  const displayName = person ? buildDisplayName(person) : (user.email ?? '');

  return (
    <Screen padded={false}>
      <AppHeader />
      <VStack gap={4} className="p-4">
        <Text variant="h2">{t('profile.title')}</Text>
        {person?.photoURL ? (
          <Image
            source={{ uri: person.photoURL }}
            style={{ width: 120, height: 120, borderRadius: 60 }}
          />
        ) : null}
        <Text>{displayName}</Text>
        <HStack gap={2}>
          <Button onPress={onChangePhoto} loading={uploading}>
            {t('profile.changePhoto')}
          </Button>
          <Button onPress={signOut} variant="ghost">
            {t('profile.signOut')}
          </Button>
        </HStack>
      </VStack>
    </Screen>
  );
}
