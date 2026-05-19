import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseStorage } from '../firebase';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export interface UploadableImage {
  blob: Blob;
  filename: string;
  contentType?: string;
}

export function validateUploadableImage(image: UploadableImage): void {
  const declaredType = image.contentType ?? image.blob.type;
  if (!declaredType.startsWith('image/')) {
    throw new Error('El archivo no es una imagen');
  }
  if (image.blob.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('La imagen supera 5 MB');
  }
}

function generateImageId(filename: string): string {
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${rand}${ext}`;
}

async function uploadToPath(path: string, image: UploadableImage): Promise<string> {
  validateUploadableImage(image);
  const storageRef = ref(getFirebaseStorage(), path);
  const contentType = image.contentType ?? image.blob.type;
  await uploadBytes(storageRef, image.blob, { contentType });
  return getDownloadURL(storageRef);
}

export async function uploadMunicipalityImage(
  municipalityId: string,
  image: UploadableImage,
): Promise<string> {
  return uploadToPath(
    `municipalities/${municipalityId}/images/${generateImageId(image.filename)}`,
    image,
  );
}

export async function uploadPersonImage(
  personId: string,
  image: UploadableImage,
): Promise<string> {
  return uploadToPath(`persons/${personId}/photos/${generateImageId(image.filename)}`, image);
}

export async function deleteImageByURL(url: string): Promise<void> {
  const storageRef = ref(getFirebaseStorage(), url);
  await deleteObject(storageRef);
}
