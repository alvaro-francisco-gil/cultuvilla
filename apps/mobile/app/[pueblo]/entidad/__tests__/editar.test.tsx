import { render, waitFor } from '@testing-library/react-native';
import OrgEditScreen from '../[orgId]/edit';

const mockRedirect = jest.fn((_props: { href: string }) => null);
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ orgId: 'org1' }),
  Redirect: (props: { href: string }) => mockRedirect(props),
  router: { back: jest.fn() },
}));
jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../components/layout/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('../../../lib/auth/useOrgCapabilities', () => ({
  useOrgCapabilities: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganization: jest.fn().mockResolvedValue({
    id: 'org1', name: 'Peña', description: null, type: 'peña', images: [], municipalityId: 'm1',
  }),
  updateOrganization: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({
  uploadOrganizationImage: jest.fn(),
  deleteImageByURL: jest.fn(),
}));

import { useOrgCapabilities } from '../../../lib/auth/useOrgCapabilities';

describe('OrgEditScreen guard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('redirects to the org detail when the viewer cannot manage', async () => {
    (useOrgCapabilities as jest.Mock).mockReturnValue({ canManage: false, uid: 'u1', loading: false });
    render(<OrgEditScreen />);
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith({ href: '/o/org1' }));
  });

  it('does not redirect before the org has finished loading', async () => {
    const { getOrganization } = jest.requireMock('@cultuvilla/shared/services/organizationService') as {
      getOrganization: jest.Mock;
    };
    getOrganization.mockImplementation(() => new Promise(() => {}));
    (useOrgCapabilities as jest.Mock).mockReturnValue({ canManage: false, uid: 'u1', loading: false });
    render(<OrgEditScreen />);
    await waitFor(() => expect(getOrganization).toHaveBeenCalled());
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
