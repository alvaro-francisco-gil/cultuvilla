import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { OrganizationsManager } from '../OrganizationsManager';
import {
  getOrganizationsByMunicipality, requestOrganization, approveOrganization,
} from '@cultuvilla/shared/services/organizationService';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';

jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganizationsByMunicipality: jest.fn(),
  requestOrganization: jest.fn().mockResolvedValue('new-org'),
  approveOrganization: jest.fn().mockResolvedValue(undefined),
  rejectOrganization: jest.fn().mockResolvedValue(undefined),
  deleteOrganization: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../../lib/auth/useEntityCapabilities', () => ({ useEntityCapabilities: jest.fn() }));

const mockCaps = useEntityCapabilities as jest.Mock;
const mockGet = getOrganizationsByMunicipality as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue([]);
  mockCaps.mockReturnValue({ canManage: false, canApprove: false, uid: 'alice', loading: false });
});

describe('<OrganizationsManager>', () => {
  it('a villager submitting requests a pending organization (no auto-approve)', async () => {
    const { getByTestId } = render(<OrganizationsManager villageId="m1" />);
    fireEvent.changeText(getByTestId('org-name-input'), 'Peña El Pilar');
    fireEvent.press(getByTestId('org-submit'));
    await waitFor(() =>
      expect(requestOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Peña El Pilar', type: 'peña', municipalityId: 'm1', requestedBy: 'alice', status: 'pending',
        }),
      ),
    );
    expect(approveOrganization).not.toHaveBeenCalled();
  });

  it('an organizer submitting requests then auto-approves', async () => {
    mockCaps.mockReturnValue({ canManage: true, canApprove: true, uid: 'boss', loading: false });
    const { getByTestId } = render(<OrganizationsManager villageId="m1" />);
    fireEvent.changeText(getByTestId('org-name-input'), 'Peña Nueva');
    fireEvent.press(getByTestId('org-submit'));
    await waitFor(() => expect(requestOrganization).toHaveBeenCalled());
    await waitFor(() => expect(approveOrganization).toHaveBeenCalledWith('new-org', 'boss'));
  });

  it('a villager sees approved orgs + their own pending, not others’ pending', async () => {
    mockGet.mockResolvedValue([
      { id: 'a', name: 'Aprobada', description: null, imageURL: null, type: 'peña', status: 'approved', municipalityId: 'm1', requestedBy: 'x', approvedBy: 'b', decidedAt: null },
      { id: 'mine', name: 'MiPropuesta', description: null, imageURL: null, type: 'peña', status: 'pending', municipalityId: 'm1', requestedBy: 'alice', approvedBy: null, decidedAt: null },
      { id: 'other', name: 'OtraPendiente', description: null, imageURL: null, type: 'peña', status: 'pending', municipalityId: 'm1', requestedBy: 'bob', approvedBy: null, decidedAt: null },
    ]);
    const { findByText, queryByText } = render(<OrganizationsManager villageId="m1" />);
    expect(await findByText('Aprobada')).toBeTruthy();
    expect(await findByText('MiPropuesta')).toBeTruthy();
    expect(queryByText('OtraPendiente')).toBeNull();
  });

  it('an organizer can approve a pending row', async () => {
    mockCaps.mockReturnValue({ canManage: true, canApprove: true, uid: 'boss', loading: false });
    mockGet.mockResolvedValue([
      { id: 'o1', name: 'Peña Vieja', description: null, imageURL: null, type: 'peña', status: 'pending', municipalityId: 'm1', requestedBy: 'alice', approvedBy: null, decidedAt: null },
    ]);
    const { findByTestId } = render(<OrganizationsManager villageId="m1" />);
    fireEvent.press(await findByTestId('action-approve'));
    await waitFor(() => expect(approveOrganization).toHaveBeenCalledWith('o1', 'boss'));
  });
});
