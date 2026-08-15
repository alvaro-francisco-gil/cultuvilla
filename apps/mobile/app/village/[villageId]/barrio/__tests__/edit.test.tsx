import { render, waitFor } from '@testing-library/react-native';
import BarrioEditScreen from '../[barrioId]/edit';

const mockRedirect = jest.fn((_props: { href: string }) => null);
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', barrioId: 'b1' }),
  Redirect: (props: { href: string }) => mockRedirect(props),
  router: { back: jest.fn(), replace: jest.fn() },
}));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: jest.fn(),
}));
jest.mock('../../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getBarrio: jest.fn(),
  updateBarrio: jest.fn(),
  deleteBarrio: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/moderationService', () => ({
  hideContent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({
  uploadBarrioImage: jest.fn(),
  deleteImageByURL: jest.fn(),
}));

import { useEntityCapabilities } from '../../../../../lib/auth/useEntityCapabilities';
import { getBarrio } from '@cultuvilla/shared/services/municipalityService';

function mockCaps(opts: { canManage: boolean; uid: string | null; canEdit: boolean }) {
  const caps = {
    canManage: opts.canManage,
    canApprove: opts.canManage,
    uid: opts.uid,
    loading: false,
    canEdit: jest.fn(() => opts.canEdit),
    canDelete: jest.fn(() => opts.canEdit),
  };
  (useEntityCapabilities as jest.Mock).mockReturnValue(caps);
  return caps;
}

describe('BarrioEditScreen guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getBarrio as jest.Mock).mockResolvedValue({
      id: 'b1',
      name: 'Centro',
      images: [],
      municipalityId: 'm1',
      proposedBy: 'creator',
      status: 'active',
    });
  });

  it('redirects to the barrio detail when the viewer can neither manage nor edit', async () => {
    mockCaps({ canManage: false, uid: 'u1', canEdit: false });
    render(<BarrioEditScreen />);
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith({ href: '/village/m1/barrio/b1' }));
  });

  it('lets the creator edit their own barrio without being a village admin', async () => {
    const caps = mockCaps({ canManage: false, uid: 'creator', canEdit: true });
    const { findByDisplayValue } = render(<BarrioEditScreen />);
    await findByDisplayValue('Centro');
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(caps.canEdit).toHaveBeenCalledWith('creator');
  });
});
