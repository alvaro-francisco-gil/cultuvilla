import { render, waitFor } from '@testing-library/react-native';
import OrgEditScreen from '../[orgId]/edit';

const mockRedirect = jest.fn((_props: { href: string }) => null);
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ orgId: 'org1' }),
  Redirect: (props: { href: string }) => mockRedirect(props),
  router: { back: jest.fn() },
}));
jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../lib/auth/useOrgCapabilities', () => ({
  useOrgCapabilities: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganization: jest.fn().mockResolvedValue({
    id: 'org1', name: 'Peña', description: null, type: 'peña', imageURL: null, municipalityId: 'm1',
  }),
  updateOrganization: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({ uploadOrganizationImage: jest.fn() }));

import { useOrgCapabilities } from '../../../lib/auth/useOrgCapabilities';

describe('OrgEditScreen guard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('redirects to the org detail when the viewer cannot manage', async () => {
    (useOrgCapabilities as jest.Mock).mockReturnValue({ canManage: false, uid: 'u1', loading: false });
    render(<OrgEditScreen />);
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith({ href: '/o/org1' }));
  });
});
