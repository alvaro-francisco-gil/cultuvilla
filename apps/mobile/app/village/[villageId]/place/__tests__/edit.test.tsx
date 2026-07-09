import { render } from '@testing-library/react-native';
import PlaceEditScreen from '../[placeId]/edit';

const mockRedirect = jest.fn((_props: { href: string }) => null);
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', placeId: 'p1' }),
  Redirect: (props: { href: string }) => mockRedirect(props),
  router: { back: jest.fn() },
}));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: jest.fn(),
}));
jest.mock('../../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getPlace: jest.fn().mockResolvedValue({
    id: 'p1', name: 'Plaza', kind: 'cemetery', description: '', imageURL: null, municipalityId: 'm1',
  }),
  updatePlace: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({ uploadPlaceImage: jest.fn() }));

import { useEntityCapabilities } from '../../../../../lib/auth/useEntityCapabilities';

describe('PlaceEditScreen guard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('redirects to the place detail when the viewer cannot manage', () => {
    (useEntityCapabilities as jest.Mock).mockReturnValue({ canManage: false, uid: 'u1', loading: false });
    render(<PlaceEditScreen />);
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/village/m1/place/p1' });
  });
});
