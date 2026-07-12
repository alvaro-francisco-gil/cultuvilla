import * as ImagePicker from 'expo-image-picker';
import { pickAndCropSquare } from '../imageCrop';

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  launchImageLibraryAsync: jest.fn(),
}));

const launch = ImagePicker.launchImageLibraryAsync as jest.Mock;

const ASSET = { uri: 'file:///tmp/pic.jpg', fileName: 'pic.jpg', mimeType: 'image/jpeg' };
const FAKE_BLOB = { size: 10, type: 'image/jpeg' } as unknown as Blob;

/** Stub XMLHttpRequest so uriToBlob (native reads the picked file via XHR, not
 * fetch — see lib/uriToBlob) resolves to FAKE_BLOB without touching the disk. */
function stubXhr() {
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
  return { open };
}

describe('pickAndCropSquare (native)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    launch.mockReset();
  });

  it('opens the OS editor with a locked 1:1 aspect and maps the result', async () => {
    launch.mockResolvedValue({ canceled: false, assets: [ASSET] });
    const { open } = stubXhr();

    const result = await pickAndCropSquare();

    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }),
    );
    expect(open).toHaveBeenCalledWith('GET', ASSET.uri, true);
    expect(result).toEqual({
      blob: FAKE_BLOB,
      filename: 'pic.jpg',
      contentType: 'image/jpeg',
      previewUri: ASSET.uri,
    });
  });

  it('returns null when the user cancels the picker/crop', async () => {
    launch.mockResolvedValue({ canceled: true, assets: [] });
    expect(await pickAndCropSquare()).toBeNull();
  });
});
