// Manual mock for the native cropper. jest-expo does not transpile this
// untranspiled ESM package (it is outside transformIgnorePatterns' allowlist),
// so importing the real module throws "Cannot use import statement outside a
// module". Tests that exercise the native crop path re-mock openPicker per-case.
const ImageCropPicker = {
  openPicker: jest.fn(),
  openCamera: jest.fn(),
  openCropper: jest.fn(),
  clean: jest.fn(),
  cleanSingle: jest.fn(),
};

module.exports = ImageCropPicker;
module.exports.default = ImageCropPicker;
