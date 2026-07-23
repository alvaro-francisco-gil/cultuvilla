import { render, waitFor } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', posterId: 'fp1' }),
  router: { replace: jest.fn(), back: jest.fn() },
  Redirect: () => null,
}));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: () => ({ canManage: true, canApprove: true, uid: 'u1', loading: false }),
}));
jest.mock('../../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('@cultuvilla/shared/services/festivalPosterService', () => ({
  getFestivalPoster: jest.fn().mockResolvedValue({
    id: 'fp1',
    municipalityId: 'm1',
    year: 2025,
    title: 'Fiestas',
    images: [],
    datePrecision: 'year',
    startsAt: null,
    endsAt: null,
    status: 'approved',
  }),
  updateFestivalPoster: jest.fn(),
  deleteFestivalPoster: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({
  uploadFestivalPosterImage: jest.fn(),
}));
jest.mock('../../../../../components/feature/OrganizerPicker', () => ({ OrganizerPicker: () => null }));

import PosterEditScreen from '../[posterId]/edit';

it('renders the poster edit form with a delete action', async () => {
  const { getByLabelText, getByDisplayValue } = render(<PosterEditScreen />);
  await waitFor(() => getByDisplayValue('2025'));
  // useT is mocked to identity, so the delete affordance's label is the key.
  expect(getByLabelText('common.delete')).toBeTruthy();
});
