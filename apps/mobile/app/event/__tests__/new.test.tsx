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
  getMunicipality: jest.fn().mockResolvedValue({ name: 'Pueblo', coordinates: { lat: 1, lng: 2 } }),
}));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganizationsByMunicipality: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/orgMemberService', () => ({
  getOrgMembershipsByUserInMunicipality: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getVillageMembers: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/userService', () => ({
  getUserProfile: jest.fn().mockResolvedValue(null),
}));
jest.mock('@cultuvilla/shared/services/eventService', () => ({
  createEvent: jest.fn().mockResolvedValue('e-1'),
  updateEvent: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({
  uploadEventImage: jest.fn(),
}));
// Mock OrganizerPicker to keep the test surface-level
jest.mock('../../../components/feature/OrganizerPicker', () => ({
  OrganizerPicker: () => {
    const { View } = require('react-native');
    return <View testID="organizer-picker" />;
  },
}));
// Mock LocationPicker to avoid expo-location complexities in unit tests
jest.mock('../../../components/feature/LocationPicker', () => ({
  LocationPicker: () => {
    const { View } = require('react-native');
    return <View testID="location-picker" />;
  },
}));
// Mock DateField so we can trigger onChange directly without driving the modal UI
jest.mock('../../../components/primitives/DateField', () => ({
  DateField: ({ onChange, testID }: { onChange: (d: Date) => void; testID?: string }) => {
    const { Pressable } = require('react-native');
    return (
      <Pressable
        testID={testID}
        onPress={() => onChange(new Date('2026-08-01'))}
        accessibilityLabel={testID}
      />
    );
  },
}));

describe('NewEventScreen stepper', () => {
  it('renders the first step and gates Next until title + description are set', async () => {
    const { getByText, getByLabelText, getByTestId, queryByTestId } = render(<NewEventScreen />);
    // Step 1 (Lo básico) shows the title input.
    await waitFor(() => expect(getByLabelText('event.title')).toBeTruthy());
    fireEvent.press(getByText('common.stepper.next'));
    expect(queryByTestId('startDate')).toBeNull(); // blocked: empty title/description
    fireEvent.changeText(getByLabelText('event.title'), 'Fiesta');
    fireEvent.changeText(getByLabelText('event.description'), 'Desc');
    fireEvent.press(getByText('common.stepper.next'));
    // Now in step 2 (Cuándo y dónde) — endDate must NOT be present
    expect(queryByTestId('endDate')).toBeNull();
    // startDate DateField must still be present
    expect(getByTestId('startDate')).toBeTruthy();
    // locationName input must be accessible
    expect(getByLabelText('event.locationName')).toBeTruthy();
  });

  it('step 3 renders the OrganizerPicker', async () => {
    const { getByText, getByLabelText, getByTestId, queryByTestId } = render(<NewEventScreen />);
    await waitFor(() => expect(getByLabelText('event.title')).toBeTruthy());
    // Advance through step 1
    fireEvent.changeText(getByLabelText('event.title'), 'Fiesta');
    fireEvent.changeText(getByLabelText('event.description'), 'Desc');
    fireEvent.press(getByText('common.stepper.next'));
    // Confirm in step 2: no endDate, has startDate
    await waitFor(() => expect(getByTestId('startDate')).toBeTruthy());
    expect(queryByTestId('endDate')).toBeNull();
    // Set startDate (via mocked DateField) to allow advancing to step 3
    fireEvent.press(getByTestId('startDate'));
    // Wait for locationName to be seeded from the mocked municipality, then advance
    await waitFor(() => expect(getByLabelText('event.locationName')).toBeTruthy());
    fireEvent.press(getByText('common.stepper.next'));
    // Now in step 3 (Detalles) — OrganizerPicker must be rendered
    await waitFor(() => expect(getByTestId('organizer-picker')).toBeTruthy());
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

  it('renders OrganizerPicker in the details step (navigation regression)', async () => {
    const { getByText, getByLabelText, getByTestId, queryByTestId } = render(<NewEventScreen />);
    await waitFor(() => expect(getByLabelText('event.title')).toBeTruthy());
    // Fill step 1
    fireEvent.changeText(getByLabelText('event.title'), 'Fiesta');
    fireEvent.changeText(getByLabelText('event.description'), 'Desc');
    fireEvent.press(getByText('common.stepper.next'));
    // Confirm in step 2: no endDate, has startDate
    await waitFor(() => expect(getByTestId('startDate')).toBeTruthy());
    expect(queryByTestId('endDate')).toBeNull();
    // Set startDate via mocked DateField to unblock step 2 validation
    fireEvent.press(getByTestId('startDate'));
    await waitFor(() => expect(getByLabelText('event.locationName')).toBeTruthy());
    // Advance to step 3
    fireEvent.press(getByText('common.stepper.next'));
    // OrganizerPicker must be visible in step 3
    await waitFor(() => expect(getByTestId('organizer-picker')).toBeTruthy());
  });
});
