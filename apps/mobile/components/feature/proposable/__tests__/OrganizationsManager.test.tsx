import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { OrganizationsManager } from '../OrganizationsManager';
import {
  requestOrganization, approveOrganization,
} from '@cultuvilla/shared/services/organizationService';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';
import { observability } from '@cultuvilla/shared';

jest.mock('@cultuvilla/shared', () => ({
  ...jest.requireActual('@cultuvilla/shared'),
  observability: { trackEvent: jest.fn() },
}));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  requestOrganization: jest.fn().mockResolvedValue('new-org'),
  newOrganizationId: jest.fn(() => 'new-org'),
  approveOrganization: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({ uploadOrganizationImage: jest.fn() }));
jest.mock('../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../../lib/auth/useEntityCapabilities', () => ({ useEntityCapabilities: jest.fn() }));

const mockCaps = useEntityCapabilities as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockCaps.mockReturnValue({ canManage: false, canApprove: false, uid: 'alice', loading: false });
});

describe('<OrganizationsManager>', () => {
  it('a villager submitting requests a pending organization (no auto-approve)', async () => {
    const { getByTestId, getByText } = render(<OrganizationsManager villageId="m1" />);
    getByText('organization.submitRequest');
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
    expect(observability.trackEvent).toHaveBeenCalledWith('org.create.success', { municipalityId: 'm1' });
  });

  it('an organizer submitting requests then auto-approves', async () => {
    mockCaps.mockReturnValue({ canManage: true, canApprove: true, uid: 'boss', loading: false });
    const { getByTestId } = render(<OrganizationsManager villageId="m1" />);
    fireEvent.changeText(getByTestId('org-name-input'), 'Peña Nueva');
    fireEvent.press(getByTestId('org-submit'));
    await waitFor(() => expect(requestOrganization).toHaveBeenCalled());
    await waitFor(() => expect(approveOrganization).toHaveBeenCalledWith('new-org'));
  });
});
