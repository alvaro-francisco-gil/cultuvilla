// Type surface for the platform-split square cropper. Metro resolves the
// concrete implementation per platform (imageCrop.native.ts on native,
// imageCrop.web.tsx on web); TypeScript does not understand platform
// extensions for a bare `./imageCrop` import, so this base declaration gives
// `tsc` (and editors) the shared module shape. Both implementations must match it.
import type { ReactElement } from 'react';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';

export declare function pickAndCropSquare(): Promise<UploadableImage | null>;
export declare function CropperHost(): ReactElement | null;
