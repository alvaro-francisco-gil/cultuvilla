// apps/mobile/app/news/__tests__/new.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import NewNewsScreen from '../new';
import { uriToBlob } from '../../../lib/images';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'uid-1', email: 'a@b.test' }, profile: { activeMunicipalityId: 'm-1' } }),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///tmp/pic.jpg', width: 100, height: 80 }],
  }),
}));
jest.mock('@cultuvilla/shared/services/newsService', () => ({
  createNewsPost: jest.fn(),
  updateNewsPost: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({
  uploadNewsImage: jest.fn(),
}));
jest.mock('../../../lib/images', () => ({ uriToBlob: jest.fn() }));

describe('NewNewsScreen', () => {
  // Regression: the picker read the asset with an inline `fetch(uri).blob()`,
  // but Expo SDK 56's winter `fetch` builds the Blob from an ArrayBuffer, which
  // RN's BlobManager rejects. Reading a news image MUST go through
  // lib/images.uriToBlob (XMLHttpRequest), never the global fetch.
  it('reads a picked image via the shared uriToBlob helper, not the global fetch', async () => {
    (uriToBlob as jest.Mock).mockResolvedValue({ size: 1, type: 'image/jpeg' });
    const fetchSpy = jest.spyOn(global, 'fetch' as never);
    const { getByText } = render(<NewNewsScreen />);

    fireEvent.press(getByText('news.compose.addImage'));

    await waitFor(() => expect(uriToBlob).toHaveBeenCalledWith('file:///tmp/pic.jpg'));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
  });
});
