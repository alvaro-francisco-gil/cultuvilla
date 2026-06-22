import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ProfileScreen from '../profile';

// Regression: changing the profile photo failed with FirebaseError
// storage/unauthorized on `persons/<id>/photos/<id>.jpeg`. The screen uploaded
// to the person-scoped storage path (whose rule needs a cross-service
// firestore.get that doesn't resolve), instead of the user-scoped path the
// onboarding flow already uses — and it never persisted the resulting URL.
// onChangePhoto must mirror onboarding: uploadUserPhoto(uid) + updatePerson.

const SELF_PERSON = {
  id: 'seed-real-user-data-1-person-alvaro',
  userId: 'uid-1',
  createdBy: 'seed',
  givenName: 'Alvaro',
  middleNames: [],
  firstSurname: 'Gil',
  secondSurname: null,
  nickname: null,
  photoURL: null,
};

const PICKED_IMAGE = { blob: {}, filename: 'pic.jpg', contentType: 'image/jpeg' };

jest.mock('@cultuvilla/shared/services/personService', () => ({
  getPersonByUserId: jest.fn(),
  getPersonsByCreator: jest.fn().mockResolvedValue([]),
  updatePerson: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({
  uploadUserPhoto: jest.fn().mockResolvedValue('https://photo.test/new.jpg'),
  uploadPersonImage: jest.fn().mockResolvedValue('https://photo.test/new.jpg'),
}));
jest.mock('@cultuvilla/shared/services/eventService', () => ({
  getEventsByCreator: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/newsService', () => ({
  getNewsCountByCreator: jest.fn().mockResolvedValue(0),
}));
jest.mock('@cultuvilla/shared/services/registrationService', () => ({
  getUserRegistrationsAcrossEvents: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganizationsByMunicipality: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/orgMemberService', () => ({
  getOrgMembershipsByUserInMunicipality: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getUserMemberships: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: jest.fn().mockResolvedValue(null),
}));
jest.mock('@cultuvilla/shared/services/userService', () => ({
  setActiveMunicipality: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/models/municipality', () => ({
  escudoThumbDisplayUrl: jest.fn().mockReturnValue(null),
}));
jest.mock('../../../lib/images', () => ({
  pickImageAsBlob: jest.fn(),
}));
jest.mock('../../../lib/firestoreErrorLog', () => ({
  withFirestoreErrorLog: (_label: string, fn: () => unknown) => fn(),
}));
// Stable references: ProfileScreen's `load` is a useCallback keyed on `user`
// and `activeMunicipalityId`, so returning fresh objects each render would
// retrigger its effect in an infinite loop.
const mockUser = { uid: 'uid-1', email: 'a@b.test', displayName: null };
const mockProfile = { activeMunicipalityId: null };
const mockRefreshProfile = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({ user: mockUser, profile: mockProfile, refreshProfile: mockRefreshProfile }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: jest.fn(),
}));
jest.mock('../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (key: string) => key }),
}));
jest.mock('../../../components/layout/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('../../../components/feature/profile/ProfileStatsRow', () => ({
  ProfileStatsRow: () => null,
}));
jest.mock('../../../components/feature/profile/PersonaScroll', () => ({
  PersonaScroll: () => null,
}));
jest.mock('../../../components/feature/profile/OrgList', () => ({ OrgList: () => null }));
jest.mock('../../../components/feature/profile/VillagesScroll', () => ({
  VillagesScroll: () => null,
}));
jest.mock('../../../components/feature/profile/ManagedEventsScroll', () => ({
  ManagedEventsScroll: () => null,
}));
jest.mock('../../../components/feature/profile/ProfileSectionHeader', () => ({
  ProfileSectionHeader: () => null,
}));
// Stub the header so we can trigger onChangePhoto via a plain button.
jest.mock('../../../components/feature/profile/ProfileHeader', () => {
  const { Pressable, Text } = require('react-native');
  return {
    ProfileHeader: ({ onPressAvatar }: { onPressAvatar?: () => void }) => (
      <Pressable testID="change-photo" onPress={onPressAvatar}>
        <Text>avatar</Text>
      </Pressable>
    ),
  };
});

describe('ProfileScreen — mis pueblos', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads the user memberships on mount', async () => {
    const personService = require('@cultuvilla/shared/services/personService');
    const villageMemberService = require('@cultuvilla/shared/services/villageMemberService');
    (personService.getPersonByUserId as jest.Mock).mockResolvedValue(null);

    render(<ProfileScreen />);

    await waitFor(() => {
      expect(villageMemberService.getUserMemberships).toHaveBeenCalledWith('uid-1');
    });
  });
});

describe('ProfileScreen — eventos gestionados', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads the events created by the user on mount', async () => {
    const personService = require('@cultuvilla/shared/services/personService');
    const eventService = require('@cultuvilla/shared/services/eventService');
    (personService.getPersonByUserId as jest.Mock).mockResolvedValue(null);

    render(<ProfileScreen />);

    await waitFor(() => {
      expect(eventService.getEventsByCreator).toHaveBeenCalledWith('uid-1');
    });
  });
});

describe('ProfileScreen — change photo', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uploads to the user-scoped path and persists photoURL on the person', async () => {
    const personService = require('@cultuvilla/shared/services/personService');
    const imageService = require('@cultuvilla/shared/services/imageService');
    const images = require('../../../lib/images');
    (personService.getPersonByUserId as jest.Mock).mockResolvedValue(SELF_PERSON);
    (images.pickImageAsBlob as jest.Mock).mockResolvedValue(PICKED_IMAGE);

    const { getByTestId } = render(<ProfileScreen />);

    // Wait for the initial load to populate selfPerson.
    await waitFor(() => {
      expect(personService.getPersonByUserId).toHaveBeenCalledWith('uid-1');
    });

    await act(async () => {
      fireEvent.press(getByTestId('change-photo'));
    });

    await waitFor(() => {
      expect(imageService.uploadUserPhoto).toHaveBeenCalledWith('uid-1', PICKED_IMAGE);
    });
    expect(imageService.uploadPersonImage).not.toHaveBeenCalled();
    expect(personService.updatePerson).toHaveBeenCalledWith(SELF_PERSON.id, {
      photoURL: 'https://photo.test/new.jpg',
    });
  });
});
