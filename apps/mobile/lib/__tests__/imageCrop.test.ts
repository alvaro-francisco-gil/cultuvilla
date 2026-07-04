import ImageCropPicker from 'react-native-image-crop-picker';
import { pickAndCropSquare } from '../imageCrop';

// react-native-image-crop-picker is auto-mocked (apps/mobile/__mocks__/), so
// openPicker is a jest.fn we drive per-case.
const openPicker = ImageCropPicker.openPicker as jest.Mock;

const FAKE_BLOB = { size: 10, type: 'image/jpeg' } as unknown as Blob;

/** Stub XMLHttpRequest so uriToBlob (native reads the cropped file via XHR, not
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
    openPicker.mockReset();
  });

  it('opens the cropper with a locked 1:1 frame and maps the result', async () => {
    openPicker.mockResolvedValue({
      path: 'file:///tmp/cropped.jpg',
      filename: 'cropped.jpg',
      mime: 'image/jpeg',
      width: 1024,
      height: 1024,
      size: 10,
    });
    const { open } = stubXhr();

    const result = await pickAndCropSquare();

    expect(openPicker).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: 'photo',
        cropping: true,
        width: 1024,
        height: 1024,
      }),
    );
    expect(open).toHaveBeenCalledWith('GET', 'file:///tmp/cropped.jpg', true);
    expect(result).toEqual({
      blob: FAKE_BLOB,
      filename: 'cropped.jpg',
      contentType: 'image/jpeg',
      previewUri: 'file:///tmp/cropped.jpg',
    });
  });

  it('returns null when the user backs out (E_PICKER_CANCELLED)', async () => {
    openPicker.mockRejectedValue({ code: 'E_PICKER_CANCELLED', message: 'User cancelled' });
    expect(await pickAndCropSquare()).toBeNull();
  });

  it('rethrows non-cancellation errors', async () => {
    openPicker.mockRejectedValue({ code: 'E_NO_LIBRARY_PERMISSION', message: 'no access' });
    await expect(pickAndCropSquare()).rejects.toMatchObject({
      code: 'E_NO_LIBRARY_PERMISSION',
    });
  });
});
