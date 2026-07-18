import { render } from '@testing-library/react-native';
import BarrioEditScreen from '../[barrioId]/edit';

const mockRedirect = jest.fn((_props: { href: string }) => null);
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', barrioId: 'b1' }),
  Redirect: (props: { href: string }) => mockRedirect(props),
  router: { back: jest.fn() },
}));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: jest.fn(),
}));
jest.mock('../../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getBarrio: jest.fn().mockResolvedValue({ id: 'b1', name: 'Centro', images: [], municipalityId: 'm1' }),
  updateBarrio: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({
  uploadBarrioImage: jest.fn(),
  deleteImageByURL: jest.fn(),
}));

import { useEntityCapabilities } from '../../../../../lib/auth/useEntityCapabilities';

describe('BarrioEditScreen guard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('redirects to the barrio detail when the viewer cannot manage', () => {
    (useEntityCapabilities as jest.Mock).mockReturnValue({ canManage: false, uid: 'u1', loading: false });
    render(<BarrioEditScreen />);
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/village/m1/barrio/b1' });
  });
});
