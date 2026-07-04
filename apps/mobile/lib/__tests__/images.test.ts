import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { pickImageAsBlob } from '../images';
import { pickAndCropSquare } from '../imageCrop';

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  launchImageLibraryAsync: jest.fn(),
}));

// The square path delegates to the in-app cropper; stub it so this suite stays
// focused on the plain (non-square) library path and the square→cropper routing.
jest.mock('../imageCrop', () => ({
  pickAndCropSquare: jest.fn(),
  CropperHost: () => null,
}));

const launch = ImagePicker.launchImageLibraryAsync as jest.Mock;
const crop = pickAndCropSquare as jest.Mock;

const ASSET = {
  uri: 'file:///tmp/pic.jpg',
  fileName: 'pic.jpg',
  mimeType: 'image/jpeg',
};

const FAKE_BLOB = { size: 42, type: 'image/jpeg' } as unknown as Blob;

describe('pickImageAsBlob', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    launch.mockReset();
    crop.mockReset();
  });

  it('returns null when the picker is cancelled', async () => {
    launch.mockResolvedValue({ canceled: true, assets: [] });
    expect(await pickImageAsBlob()).toBeNull();
  });

  it('routes square picks through the in-app cropper, not the plain library path', async () => {
    const cropped = {
      blob: FAKE_BLOB,
      filename: 'cropped.jpg',
      contentType: 'image/jpeg',
      previewUri: 'blob:cropped',
    };
    crop.mockResolvedValue(cropped);

    const result = await pickImageAsBlob({ square: true });

    expect(crop).toHaveBeenCalledTimes(1);
    expect(launch).not.toHaveBeenCalled();
    expect(result).toEqual(cropped);
  });

  // Regression: Expo SDK 56 overrides the global `fetch` with its winter
  // polyfill, whose `.blob()` throws "Creating blobs from 'ArrayBuffer' ... are
  // not supported" on RN. The native path MUST read the URI via XMLHttpRequest
  // and never touch the global fetch.
  it('on native reads the asset via XMLHttpRequest, not the global fetch', async () => {
    launch.mockResolvedValue({ canceled: false, assets: [ASSET] });
    const fetchSpy = jest.spyOn(global, 'fetch' as never);

    const open = jest.fn();
    const send = jest.fn(function (this: { onload: () => void; response: Blob }) {
      this.response = FAKE_BLOB;
      this.onload();
    });
    // @ts-expect-error minimal XHR stand-in for the test
    global.XMLHttpRequest = jest.fn(() => ({
      open,
      send,
      set onload(fn: () => void) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        (this as { _onload?: () => void })._onload = fn;
      },
      get onload() {
        return (this as { _onload?: () => void })._onload!;
      },
      onerror: null,
      responseType: '',
      response: undefined,
    }));

    const result = await pickImageAsBlob();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith('GET', ASSET.uri, true);
    expect(result).toEqual({
      blob: FAKE_BLOB,
      filename: 'pic.jpg',
      contentType: 'image/jpeg',
      previewUri: ASSET.uri,
    });
  });

  it('on web reads the asset via the browser fetch', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    launch.mockResolvedValue({ canceled: false, assets: [ASSET] });
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValue({ blob: async () => FAKE_BLOB } as never);

    const result = await pickImageAsBlob();

    expect(fetchSpy).toHaveBeenCalledWith(ASSET.uri);
    expect(result?.blob).toBe(FAKE_BLOB);
  });
});
