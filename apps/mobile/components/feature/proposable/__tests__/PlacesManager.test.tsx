import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PlacesManager } from '../PlacesManager';
import {
  getPlaces, createPlace, proposePlace, approvePlace,
} from '@cultuvilla/shared/services/municipalityService';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';

jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getPlaces: jest.fn(),
  createPlace: jest.fn().mockResolvedValue('new-id'),
  proposePlace: jest.fn().mockResolvedValue('new-id'),
  approvePlace: jest.fn().mockResolvedValue(undefined),
  rejectPlace: jest.fn().mockResolvedValue(undefined),
  updatePlace: jest.fn().mockResolvedValue(undefined),
  deletePlace: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({ uploadPlaceImage: jest.fn() }));
jest.mock('../../../../lib/images', () => ({ pickImageAsBlob: jest.fn() }));
jest.mock('../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../../lib/auth/useEntityCapabilities', () => ({ useEntityCapabilities: jest.fn() }));

const mockCaps = useEntityCapabilities as jest.Mock;
const mockGet = getPlaces as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue([]);
  mockCaps.mockReturnValue({ canManage: false, canApprove: false, uid: 'alice', loading: false });
});

describe('<PlacesManager>', () => {
  it('a villager submitting the form proposes a pending place (default kind)', async () => {
    const { getByTestId } = render(<PlacesManager villageId="m1" />);
    fireEvent.changeText(getByTestId('place-name-input'), 'Fuente');
    fireEvent.press(getByTestId('place-submit'));
    await waitFor(() =>
      expect(proposePlace).toHaveBeenCalledWith('m1', {
        name: 'Fuente', kind: 'cemetery', description: '', municipalityId: 'm1', proposedBy: 'alice',
      }),
    );
    expect(createPlace).not.toHaveBeenCalled();
  });

  it('an organizer submitting the form creates the place directly', async () => {
    mockCaps.mockReturnValue({ canManage: true, canApprove: true, uid: 'boss', loading: false });
    const { getByTestId } = render(<PlacesManager villageId="m1" />);
    fireEvent.changeText(getByTestId('place-name-input'), 'Iglesia');
    fireEvent.press(getByTestId('place-submit'));
    await waitFor(() =>
      expect(createPlace).toHaveBeenCalledWith('m1', {
        name: 'Iglesia', kind: 'cemetery', description: '', municipalityId: 'm1',
      }),
    );
    expect(proposePlace).not.toHaveBeenCalled();
  });

  it('an organizer can approve a pending row', async () => {
    mockCaps.mockReturnValue({ canManage: true, canApprove: true, uid: 'boss', loading: false });
    mockGet.mockResolvedValue([
      { id: 'p1', name: 'Ermita', kind: 'hermitage', description: null, municipalityId: 'm1', imageURL: null, status: 'pending', proposedBy: 'alice', reviewedBy: null, reviewedAt: null },
    ]);
    const { findByTestId } = render(<PlacesManager villageId="m1" mode="manage" />);
    fireEvent.press(await findByTestId('action-approve'));
    await waitFor(() => expect(approvePlace).toHaveBeenCalledWith('m1', 'p1', 'boss'));
  });
});
