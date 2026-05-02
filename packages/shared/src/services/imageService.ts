import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

function assertImage(file: File): void {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen');
  if (file.size > MAX_IMAGE_SIZE_BYTES) throw new Error('La imagen supera 5 MB');
}

function generateImageId(filename: string): string {
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${rand}${ext}`;
}

export async function uploadVillageImage(villageId: string, file: File): Promise<string> {
  assertImage(file);
  const imageId = generateImageId(file.name);
  const storageRef = ref(storage, `villages/${villageId}/images/${imageId}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

export async function uploadPersonImage(personId: string, file: File): Promise<string> {
  assertImage(file)
  const imageId = generateImageId(file.name)
  const storageRef = ref(storage, `persons/${personId}/photos/${imageId}`)
  await uploadBytes(storageRef, file, { contentType: file.type })
  return getDownloadURL(storageRef)
}

export async function deleteImageByURL(url: string): Promise<void> {
  const storageRef = ref(storage, url);
  await deleteObject(storageRef);
}
