import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { BarriosManager } from '../BarriosManager';
import { createBarrio, newBarrioId } from '@cultuvilla/shared/services/municipalityService';
import { uploadBarrioImage } from '@cultuvilla/shared/services/imageService';
import { pickImageAsBlob } from '../../../../lib/images';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';

jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  newBarrioId: jest.fn().mockReturnValue('new-id'),
  createBarrio: jest.fn().mockResolvedValue('new-id'),
  updateBarrio: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({
  uploadBarrioImage: jest.fn().mockResolvedValue('https://example.com/barrio.jpg'),
  deleteImageByURL: jest.fn(),
}));
jest.mock('../../../../lib/images', () => ({ pickImageAsBlob: jest.fn() }));
jest.mock('../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../../lib/auth/useEntityCapabilities', () => ({ useEntityCapabilities: jest.fn() }));

const mockCaps = useEntityCapabilities as jest.Mock;
const mockPick = pickImageAsBlob as jest.Mock;

const stubImage = { blob: {} as Blob, filename: 'barrio.jpg', contentType: 'image/jpeg', previewUri: 'file://barrio.jpg' };

beforeEach(() => {
  jest.clearAllMocks();
  mockPick.mockResolvedValue(stubImage);
  mockCaps.mockReturnValue({ canManage: false, canApprove: false, uid: 'alice', loading: false });
});

describe('<BarriosManager>', () => {
  it('any member submitting the form creates the barrio directly (optimistic)', async () => {
    const { getByTestId } = render(<BarriosManager villageId="m1" />);
    fireEvent.changeText(getByTestId('barrio-name-input'), 'Centro');
    fireEvent.press(getByTestId('barrio-submit'));
    await waitFor(() =>
      expect(createBarrio).toHaveBeenCalledWith(
        'm1',
        { name: 'Centro', municipalityId: 'm1', proposedBy: 'alice', images: [] },
        'new-id',
      ),
    );
  });

  it('an admin creates the barrio the same way', async () => {
    mockCaps.mockReturnValue({ canManage: true, canApprove: true, uid: 'boss', loading: false });
    const { getByTestId } = render(<BarriosManager villageId="m1" />);
    fireEvent.changeText(getByTestId('barrio-name-input'), 'Norte');
    fireEvent.press(getByTestId('barrio-submit'));
    await waitFor(() =>
      expect(createBarrio).toHaveBeenCalledWith(
        'm1',
        { name: 'Norte', municipalityId: 'm1', proposedBy: 'boss', images: [] },
        'new-id',
      ),
    );
  });

  it('uploads a picked image to the minted barrio id and includes it in the create payload', async () => {
    const { getByTestId, getByLabelText } = render(<BarriosManager villageId="m1" />);
    fireEvent.press(getByLabelText('village.admin.barrios.addImage'));
    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    fireEvent.changeText(getByTestId('barrio-name-input'), 'Centro');
    fireEvent.press(getByTestId('barrio-submit'));

    expect(uploadBarrioImage).toHaveBeenCalledWith('m1', 'new-id', stubImage);
    await waitFor(() =>
      expect(createBarrio).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({ images: ['https://example.com/barrio.jpg'] }),
        'new-id',
      ),
    );
  });

  it('mints the barrio id up front via newBarrioId', () => {
    render(<BarriosManager villageId="m1" />);
    expect(newBarrioId).toHaveBeenCalledWith('m1');
  });
});
