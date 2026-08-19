// apps/mobile/app/event/__tests__/new.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NewEventScreen from '../new';
import { pickImageAsBlob } from '../../../lib/images';
import { createEvent, updateEvent } from '@cultuvilla/shared/services/eventService';
import { uploadEventImage } from '@cultuvilla/shared/services/imageService';

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
jest.mock('../../../lib/images', () => ({ pickImageAsBlob: jest.fn() }));

// The event's village now comes from the user's joined villages.
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getUserMemberships: jest.fn().mockResolvedValue([
    { municipalityId: 'm-1', role: 'user', joinedAt: new Date(), profileCompletedAt: null },
  ]),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: jest.fn().mockResolvedValue({
    id: 'm-1', name: 'Pueblo', province: 'Prov', coordinates: { lat: 1, lng: 2 },
  }),
}));
jest.mock('@cultuvilla/shared/models/municipality', () => ({
  escudoThumbDisplayUrl: () => null,
}));
jest.mock('@cultuvilla/shared/services/feedService', () => ({
  haversineKm: () => 0,
}));
jest.mock('@cultuvilla/shared/services/eventService', () => ({
  createEvent: jest.fn().mockResolvedValue('e-1'),
  updateEvent: jest.fn(),
  getEvent: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({
  uploadEventImage: jest.fn(),
}));
jest.mock('../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: () => ({
    canManage: true,
    canApprove: true,
    uid: 'u1',
    loading: false,
    canEdit: () => true,
    canDelete: () => true,
  }),
}));

// Surface-level stubs for the composed step components.
jest.mock('../../../components/feature/OrganizerPicker', () => ({
  OrganizerPicker: () => {
    const { View } = require('react-native');
    return <View testID="organizer-picker" />;
  },
}));
jest.mock('../../../components/feature/LocationField', () => ({
  LocationField: ({ onChange }: { onChange: (c: { lat: number; lng: number }, a: string) => void }) => {
    const { Pressable } = require('react-native');
    return (
      <Pressable testID="location-field" onPress={() => onChange({ lat: 1, lng: 2 }, 'Plaza Mayor')} />
    );
  },
}));
jest.mock('../../../components/feature/MyVillagePicker', () => ({
  MyVillagePicker: ({ value }: { value: string | null }) => {
    const { Text } = require('react-native');
    return <Text testID="village-picker">{value ?? ''}</Text>;
  },
}));
// Drive DateTimeField.onChange directly; also surface the incoming value for assertions.
jest.mock('../../../components/primitives/DateTimeField', () => ({
  DateTimeField: ({ onChange, testID, value }: { onChange: (d: Date) => void; testID?: string; value: Date | null }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID={testID} onPress={() => onChange(new Date('2026-08-01T18:00'))}>
        <Text testID={`${testID}-value`}>{value ? value.toISOString() : ''}</Text>
      </Pressable>
    );
  },
}));

describe('NewEventScreen stepper', () => {
  it('gates Next on title only — description is optional', async () => {
    const { getByText, getByLabelText, getByTestId, queryByTestId } = render(<NewEventScreen />);
    await waitFor(() => expect(getByLabelText('event.title')).toBeTruthy());
    fireEvent.press(getByText('common.stepper.next'));
    expect(queryByTestId('startDate')).toBeNull(); // blocked: empty title
    // Title alone unblocks; description is left empty on purpose.
    fireEvent.changeText(getByLabelText('event.title'), 'Fiesta');
    fireEvent.press(getByText('common.stepper.next'));
    // Now in step 2 (Cuándo y dónde): datetime (+ optional end), location + village present.
    expect(getByTestId('startDate')).toBeTruthy();
    // endDate is the optional multi-day end.
    expect(getByTestId('endDate')).toBeTruthy();
    expect(getByTestId('location-field')).toBeTruthy();
    expect(getByTestId('village-picker')).toBeTruthy();
  });

  it('reaches the details step (OrganizerPicker) once date + location are set', async () => {
    const { getByText, getByLabelText, getByTestId } = render(<NewEventScreen />);
    await waitFor(() => expect(getByLabelText('event.title')).toBeTruthy());
    fireEvent.changeText(getByLabelText('event.title'), 'Fiesta');
    fireEvent.changeText(getByLabelText('event.description'), 'Desc');
    fireEvent.press(getByText('common.stepper.next'));
    // Step 2: set date + location; village auto-selected from the joined village.
    await waitFor(() => expect(getByTestId('startDate')).toBeTruthy());
    fireEvent.press(getByTestId('startDate'));
    fireEvent.press(getByTestId('location-field'));
    fireEvent.press(getByText('common.stepper.next'));
    await waitFor(() => expect(getByTestId('organizer-picker')).toBeTruthy());
  });

  it('toggles "teléfono requerido" in the details step', async () => {
    const { getByText, getByLabelText, getByTestId } = render(<NewEventScreen />);
    await waitFor(() => expect(getByLabelText('event.title')).toBeTruthy());
    fireEvent.changeText(getByLabelText('event.title'), 'Fiesta');
    fireEvent.changeText(getByLabelText('event.description'), 'Desc');
    fireEvent.press(getByText('common.stepper.next'));
    await waitFor(() => expect(getByTestId('startDate')).toBeTruthy());
    fireEvent.press(getByTestId('startDate'));
    fireEvent.press(getByTestId('location-field'));
    fireEvent.press(getByText('common.stepper.next'));
    const toggle = await waitFor(() => getByTestId('telephone-required'));
    expect(toggle.props.accessibilityState.checked).toBe(false);
    fireEvent.press(toggle);
    expect(toggle.props.accessibilityState.checked).toBe(true);
  });

  it('puts the sign-up questions in their own step after the details', async () => {
    const { getByText, getByLabelText, getByTestId, queryByTestId } = render(<NewEventScreen />);
    await waitFor(() => expect(getByLabelText('event.title')).toBeTruthy());
    fireEvent.changeText(getByLabelText('event.title'), 'Fiesta');
    fireEvent.press(getByText('common.stepper.next'));
    await waitFor(() => expect(getByTestId('startDate')).toBeTruthy());
    fireEvent.press(getByTestId('startDate'));
    fireEvent.press(getByTestId('location-field'));
    fireEvent.press(getByText('common.stepper.next'));
    // Details: toggles and organizers, but no question builder.
    await waitFor(() => expect(getByTestId('telephone-required')).toBeTruthy());
    expect(queryByTestId('signup-question-add')).toBeNull();

    fireEvent.press(getByText('common.stepper.next'));
    await waitFor(() => expect(getByTestId('signup-question-add')).toBeTruthy());
    // Last step: the primary button submits instead of advancing.
    expect(getByTestId('event-form-primary')).toHaveTextContent('event.createEvent');
  });

  // Regression: the cover picker must go through lib/images.pickImageAsBlob,
  // which reads the URI via XMLHttpRequest, not the global winter `fetch`.
  it('picks the cover image via the shared pickImageAsBlob helper', async () => {
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

  it('pre-seeds the event start with a 5-minute-aligned current time', async () => {
    const { getByText, getByLabelText, getByTestId } = render(<NewEventScreen />);
    await waitFor(() => expect(getByLabelText('event.title')).toBeTruthy());
    fireEvent.changeText(getByLabelText('event.title'), 'Fiesta');
    fireEvent.press(getByText('common.stepper.next'));
    await waitFor(() => getByTestId('startDate-value'));
    const iso = getByTestId('startDate-value').props.children as string;
    expect(iso).not.toBe(''); // not the empty placeholder
    expect(new Date(iso).getMinutes() % 5).toBe(0);
  });
});

// The cover upload is a second round-trip after createEvent, and it is the one
// that dies on a weak link. These pin the ordering and, critically, that a retry
// finishes the event already created instead of creating another one.
describe('NewEventScreen cover upload', () => {
  const COVER = {
    blob: { type: 'image/jpeg' },
    filename: 'pic.jpg',
    contentType: 'image/jpeg',
    previewUri: 'file:///tmp/pic.jpg',
  };

  beforeEach(() => {
    // Clear only what these tests assert on. `jest.clearAllMocks()` would also
    // wipe the module-level resolved values (memberships, municipality) the
    // screen needs to finish loading.
    (createEvent as jest.Mock).mockReset();
    (updateEvent as jest.Mock).mockReset();
    (uploadEventImage as jest.Mock).mockReset();
    (pickImageAsBlob as jest.Mock).mockReset();
    (createEvent as jest.Mock).mockResolvedValue('e-1');
    (updateEvent as jest.Mock).mockResolvedValue(undefined);
    (pickImageAsBlob as jest.Mock).mockResolvedValue(COVER);
  });

  async function fillFormAndSubmit(utils: ReturnType<typeof render>, withCover: boolean) {
    const { getByText, getByLabelText, getByTestId } = utils;
    await waitFor(() => expect(getByLabelText('event.title')).toBeTruthy());
    if (withCover) {
      fireEvent.press(getByLabelText('event.addImage'));
      await waitFor(() => expect(pickImageAsBlob).toHaveBeenCalled());
    }
    fireEvent.changeText(getByLabelText('event.title'), 'Fiesta');
    fireEvent.press(getByText('common.stepper.next'));
    await waitFor(() => expect(getByTestId('startDate')).toBeTruthy());
    fireEvent.press(getByTestId('startDate'));
    fireEvent.press(getByTestId('location-field'));
    fireEvent.press(getByText('common.stepper.next'));
    await waitFor(() => expect(getByTestId('organizer-picker')).toBeTruthy());
    // Sign-up questions are the last step; nothing to fill in, just walk past it.
    fireEvent.press(getByText('common.stepper.next'));
    await waitFor(() => expect(getByTestId('signup-question-add')).toBeTruthy());
    fireEvent.press(getByTestId('event-form-primary'));
  }

  it('uploads the cover under the new event, then patches imageURL', async () => {
    (uploadEventImage as jest.Mock).mockResolvedValue('https://cdn.test/cover.jpg');
    await fillFormAndSubmit(render(<NewEventScreen />), true);

    await waitFor(() => expect(uploadEventImage).toHaveBeenCalled());
    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(uploadEventImage).toHaveBeenCalledWith(
      'm-1',
      'e-1',
      expect.objectContaining({ filename: 'cover.jpg', contentType: 'image/jpeg' }),
    );
    expect(updateEvent).toHaveBeenCalledWith('e-1', { imageURL: 'https://cdn.test/cover.jpg' });
  });

  // The regression: before the event id was stashed, a failed upload left the
  // event created but unnavigated, and pressing the button again ran createEvent
  // a second time — one duplicate event per retry.
  it('does not create a second event when the cover upload fails and the user retries', async () => {
    (uploadEventImage as jest.Mock)
      .mockRejectedValueOnce(
        Object.assign(new Error('Firebase Storage: Max retry time exceeded'), {
          code: 'storage/retry-limit-exceeded',
        }),
      )
      .mockResolvedValueOnce('https://cdn.test/cover.jpg');

    const utils = render(<NewEventScreen />);
    await fillFormAndSubmit(utils, true);
    await waitFor(() => expect(uploadEventImage).toHaveBeenCalledTimes(1));
    expect(createEvent).toHaveBeenCalledTimes(1);

    // Retry from the still-open form.
    fireEvent.press(utils.getByTestId('event-form-primary'));

    await waitFor(() => expect(uploadEventImage).toHaveBeenCalledTimes(2));
    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(uploadEventImage).toHaveBeenLastCalledWith('m-1', 'e-1', expect.anything());
    expect(updateEvent).toHaveBeenCalledWith('e-1', { imageURL: 'https://cdn.test/cover.jpg' });
  });

  it('skips the upload entirely when no cover was picked', async () => {
    await fillFormAndSubmit(render(<NewEventScreen />), false);

    await waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1));
    expect(uploadEventImage).not.toHaveBeenCalled();
  });
});
