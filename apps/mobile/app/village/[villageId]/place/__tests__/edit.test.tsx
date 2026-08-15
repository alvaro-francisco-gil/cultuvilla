import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import PlaceEditScreen from '../[placeId]/edit';

const mockRedirect = jest.fn((_props: { href: string }) => null);
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', placeId: 'p1' }),
  Redirect: (props: { href: string }) => mockRedirect(props),
  router: { back: jest.fn(), replace: jest.fn() },
}));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: jest.fn(),
}));
jest.mock('../../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getPlace: jest.fn(),
  updatePlace: jest.fn(),
  deletePlace: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/moderationService', () => ({
  hideContent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({
  uploadPlaceImage: jest.fn(),
  deleteImageByURL: jest.fn(),
}));
jest.mock('../../../../../components/feature/OrganizerPicker', () => ({ OrganizerPicker: () => null }));

import { useEntityCapabilities } from '../../../../../lib/auth/useEntityCapabilities';
import { getPlace, deletePlace } from '@cultuvilla/shared/services/municipalityService';
import { hideContent } from '@cultuvilla/shared/services/moderationService';

const place = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'Plaza',
  kind: 'cemetery',
  description: '',
  images: [],
  municipalityId: 'm1',
  proposedBy: 'creator',
  contributorUserIds: [],
  contributorOrgIds: [],
  status: 'active',
  ...over,
});

/** The hook's own logic is covered in lib/auth/__tests__; here we only care
 *  that the screen asks it about the place's creator instead of `canManage`. */
function mockCaps(opts: { canManage: boolean; uid: string | null; canEdit: boolean; canDelete?: boolean }) {
  const caps = {
    canManage: opts.canManage,
    canApprove: opts.canManage,
    uid: opts.uid,
    loading: false,
    canEdit: jest.fn(() => opts.canEdit),
    canDelete: jest.fn(() => opts.canDelete ?? opts.canEdit),
  };
  (useEntityCapabilities as jest.Mock).mockReturnValue(caps);
  return caps;
}

describe('PlaceEditScreen guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPlace as jest.Mock).mockResolvedValue(place());
  });

  it('redirects to the place detail when the viewer can neither manage nor edit', async () => {
    mockCaps({ canManage: false, uid: 'u1', canEdit: false });
    render(<PlaceEditScreen />);
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith({ href: '/village/m1/place/p1' }));
  });

  it('lets the creator edit their own place without being a village admin', async () => {
    const caps = mockCaps({ canManage: false, uid: 'creator', canEdit: true });
    const { findByDisplayValue } = render(<PlaceEditScreen />);
    await findByDisplayValue('Plaza');
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(caps.canEdit).toHaveBeenCalledWith('creator');
  });

  it('offers the creator a delete action for their own active place', async () => {
    mockCaps({ canManage: false, uid: 'creator', canEdit: true });
    const { findByLabelText } = render(<PlaceEditScreen />);
    expect(await findByLabelText('common.delete')).toBeTruthy();
  });

  it('hides the delete action when the viewer may edit but not delete', async () => {
    mockCaps({ canManage: false, uid: 'creator', canEdit: true, canDelete: false });
    const { findByDisplayValue, queryByLabelText } = render(<PlaceEditScreen />);
    await findByDisplayValue('Plaza');
    expect(queryByLabelText('common.delete')).toBeNull();
  });
});

// Two different acts wear the same trash icon: an admin *moderates* (audited
// soft-hide via the callable), a creator *withdraws* (hard delete, which the
// Firestore rules allow only while the doc is still active).
describe('PlaceEditScreen delete routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPlace as jest.Mock).mockResolvedValue(place());
  });

  async function confirmDelete(canManage: boolean) {
    mockCaps({ canManage, uid: canManage ? 'boss' : 'creator', canEdit: true });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    const { findByLabelText } = render(<PlaceEditScreen />);
    fireEvent.press(await findByLabelText('common.delete'));
    alert.mockRestore();
  }

  it('withdraws the place outright when a non-admin creator deletes it', async () => {
    await confirmDelete(false);
    await waitFor(() => expect(deletePlace).toHaveBeenCalledWith('m1', 'p1'));
    expect(hideContent).not.toHaveBeenCalled();
  });

  it('moderates through the audited callable when an admin deletes it', async () => {
    await confirmDelete(true);
    await waitFor(() =>
      expect(hideContent).toHaveBeenCalledWith({ collection: 'places', docId: 'p1', municipalityId: 'm1' }),
    );
    expect(deletePlace).not.toHaveBeenCalled();
  });
});
