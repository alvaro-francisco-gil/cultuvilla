// apps/mobile/app/event/__tests__/new.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NewEventScreen from '../new';
import { pickImageAsBlob } from '../../../lib/images';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'uid-1', email: 'a@b.test' }, profile: { activeMunicipalityId: 'm-1' } }),
}));
jest.mock('../../../lib/firestoreErrorLog', () => ({
  withFirestoreErrorLog: (_label: string, fn: () => unknown) => fn(),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  MediaTypeOptions: { Images: 'Images' },
}));
jest.mock('../../../lib/images', () => ({ pickImageAsBlob: jest.fn() }));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: jest.fn().mockResolvedValue({ name: 'Pueblo', coordinates: null }),
}));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganizationsByMunicipality: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/orgMemberService', () => ({
  getOrgMembershipsByUserInMunicipality: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/eventService', () => ({
  createEvent: jest.fn().mockResolvedValue('e-1'),
  updateEvent: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({
  uploadEventImage: jest.fn(),
}));

describe('NewEventScreen stepper', () => {
  it('renders the first step and gates Next until title + description are set', async () => {
    const { getByText, getByLabelText, getByTestId, queryByTestId } = render(<NewEventScreen />);
    // Icon-only indicator: detect steps by their fields. Step 1 (Lo básico)
    // shows the title input; step 2 (Cuándo y dónde) owns the startDate
    // DateField (testID "startDate").
    await waitFor(() => expect(getByLabelText('event.title')).toBeTruthy());
    fireEvent.press(getByText('common.stepper.next'));
    expect(queryByTestId('startDate')).toBeNull(); // blocked: empty title/description
    fireEvent.changeText(getByLabelText('event.title'), 'Fiesta');
    fireEvent.changeText(getByLabelText('event.description'), 'Desc');
    fireEvent.press(getByText('common.stepper.next'));
    expect(getByTestId('startDate')).toBeTruthy();
  });

  // Regression: the cover picker used an inline `fetch(uri).blob()`, but Expo
  // SDK 56's winter `fetch` builds the Blob from an ArrayBuffer, which RN's
  // BlobManager rejects ("Creating blobs from 'ArrayBuffer' ... are not
  // supported"). Picking a cover MUST go through lib/images.pickImageAsBlob,
  // which reads the URI via XMLHttpRequest (see lib/__tests__/images.test.ts).
  it('picks the cover image via the shared pickImageAsBlob helper, not the global fetch', async () => {
    (pickImageAsBlob as jest.Mock).mockResolvedValue({
      blob: { type: 'image/jpeg' },
      filename: 'pic.jpg',
      contentType: 'image/jpeg',
      previewUri: 'file:///tmp/pic.jpg',
    });
    const { getByLabelText } = render(<NewEventScreen />);
    await waitFor(() => expect(getByLabelText('event.title')).toBeTruthy());

    fireEvent.press(getByLabelText('event.addImage'));

    await waitFor(() => expect(pickImageAsBlob).toHaveBeenCalled());
  });
});
