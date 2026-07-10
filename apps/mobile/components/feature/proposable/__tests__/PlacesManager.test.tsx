import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PlacesManager } from '../PlacesManager';
import { createPlace } from '@cultuvilla/shared/services/municipalityService';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';

jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  createPlace: jest.fn().mockResolvedValue('new-id'),
  updatePlace: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({ uploadPlaceImage: jest.fn() }));
jest.mock('../../../../lib/images', () => ({ pickImageAsBlob: jest.fn() }));
jest.mock('../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../../lib/auth/useEntityCapabilities', () => ({ useEntityCapabilities: jest.fn() }));

const mockCaps = useEntityCapabilities as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockCaps.mockReturnValue({ canManage: false, canApprove: false, uid: 'alice', loading: false });
});

describe('<PlacesManager>', () => {
  it('any member submitting the form creates the place directly (default kind, optimistic)', async () => {
    const { getByTestId } = render(<PlacesManager villageId="m1" />);
    fireEvent.changeText(getByTestId('place-name-input'), 'Fuente');
    fireEvent.press(getByTestId('place-submit'));
    await waitFor(() =>
      expect(createPlace).toHaveBeenCalledWith('m1', {
        name: 'Fuente', kind: 'cemetery', description: '', municipalityId: 'm1', proposedBy: 'alice',
      }),
    );
  });

  it('an admin creates the place the same way', async () => {
    mockCaps.mockReturnValue({ canManage: true, canApprove: true, uid: 'boss', loading: false });
    const { getByTestId } = render(<PlacesManager villageId="m1" />);
    fireEvent.changeText(getByTestId('place-name-input'), 'Iglesia');
    fireEvent.press(getByTestId('place-submit'));
    await waitFor(() =>
      expect(createPlace).toHaveBeenCalledWith('m1', {
        name: 'Iglesia', kind: 'cemetery', description: '', municipalityId: 'm1', proposedBy: 'boss',
      }),
    );
  });
});
