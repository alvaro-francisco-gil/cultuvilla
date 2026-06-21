import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { BarriosManager } from '../BarriosManager';
import {
  getBarrios, createBarrio, proposeBarrio, approveBarrio,
} from '@cultuvilla/shared/services/municipalityService';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';

jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getBarrios: jest.fn(),
  createBarrio: jest.fn().mockResolvedValue('new-id'),
  proposeBarrio: jest.fn().mockResolvedValue('new-id'),
  approveBarrio: jest.fn().mockResolvedValue(undefined),
  rejectBarrio: jest.fn().mockResolvedValue(undefined),
  updateBarrio: jest.fn().mockResolvedValue(undefined),
  deleteBarrio: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({ uploadBarrioImage: jest.fn() }));
jest.mock('../../../../lib/images', () => ({ pickImageAsBlob: jest.fn() }));
jest.mock('../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../../lib/auth/useEntityCapabilities', () => ({ useEntityCapabilities: jest.fn() }));

const mockCaps = useEntityCapabilities as jest.Mock;
const mockGet = getBarrios as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue([]);
  mockCaps.mockReturnValue({ canManage: false, canApprove: false, uid: 'alice', loading: false });
});

describe('<BarriosManager>', () => {
  it('a villager submitting the form proposes a pending barrio', async () => {
    const { getByTestId } = render(<BarriosManager villageId="m1" />);
    fireEvent.changeText(getByTestId('barrio-name-input'), 'Centro');
    fireEvent.press(getByTestId('barrio-submit'));
    await waitFor(() =>
      expect(proposeBarrio).toHaveBeenCalledWith('m1', {
        name: 'Centro', municipalityId: 'm1', proposedBy: 'alice',
      }),
    );
    expect(createBarrio).not.toHaveBeenCalled();
  });

  it('an organizer submitting the form creates the barrio directly', async () => {
    mockCaps.mockReturnValue({ canManage: true, canApprove: true, uid: 'boss', loading: false });
    const { getByTestId } = render(<BarriosManager villageId="m1" />);
    fireEvent.changeText(getByTestId('barrio-name-input'), 'Norte');
    fireEvent.press(getByTestId('barrio-submit'));
    await waitFor(() =>
      expect(createBarrio).toHaveBeenCalledWith('m1', { name: 'Norte', municipalityId: 'm1' }),
    );
    expect(proposeBarrio).not.toHaveBeenCalled();
  });

  it('an organizer can approve a pending row', async () => {
    mockCaps.mockReturnValue({ canManage: true, canApprove: true, uid: 'boss', loading: false });
    mockGet.mockResolvedValue([
      { id: 'b1', name: 'Sur', municipalityId: 'm1', imageURL: null, status: 'pending', proposedBy: 'alice', approvedBy: null, decidedAt: null },
    ]);
    const { findByTestId } = render(<BarriosManager villageId="m1" />);
    fireEvent.press(await findByTestId('action-approve'));
    await waitFor(() => expect(approveBarrio).toHaveBeenCalledWith('m1', 'b1', 'boss'));
  });
});
