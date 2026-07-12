import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import * as ImagePicker from 'expo-image-picker';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import { Button } from '../components/primitives';
import { useT } from './i18n';

/** Cropped output edge in px. Matches the native cropper's cap so both platforms
 * upload a ~1024px square avatar regardless of source resolution. */
const OUTPUT_SIZE = 1024;

// Imperative bridge between pickAndCropSquare() — a plain async function called
// from onPress handlers — and the <CropperHost/> mounted once at the app root.
// Only one crop runs at a time (the user picks one image), so a single slot is
// enough. Set on host mount, cleared on unmount.
type OpenCropper = (uri: string) => Promise<Blob | null>;
let openCropper: OpenCropper | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = src;
  });
}

// react-easy-crop hands back the selected region in natural source pixels
// (croppedAreaPixels); we draw exactly that region into a square canvas, capping
// the edge at OUTPUT_SIZE so we never upload a needlessly huge blob.
async function cropToBlob(src: string, area: Area): Promise<Blob> {
  const image = await loadImage(src);
  const outSize = Math.min(Math.round(area.width), OUTPUT_SIZE);
  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outSize, outSize);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo recortar la imagen'))),
      'image/jpeg',
      0.8,
    );
  });
}

/**
 * Web square pick + crop. expo-image-picker renders a file `<input>`; the picked
 * asset is then handed to the <CropperHost/> overlay (react-easy-crop) so the user
 * pans/zooms to a 1:1 sub-section — the OS `allowsEditing` editor is a no-op on
 * web, so without this there is no crop step at all. Returns null when the user
 * cancels the file picker or the crop overlay.
 */
export async function pickAndCropSquare(): Promise<UploadableImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (!openCropper) throw new Error('CropperHost no está montado');
  const blob = await openCropper(asset.uri);
  if (!blob) return null;
  return {
    blob,
    filename: asset.fileName ?? `upload-${Date.now()}.jpg`,
    contentType: 'image/jpeg',
    previewUri: URL.createObjectURL(blob),
  };
}

/** Full-screen crop overlay, mounted once at the app root. Renders nothing until
 * pickAndCropSquare() opens it, then shows react-easy-crop with a locked 1:1
 * frame and Cancelar/Usar controls. */
export function CropperHost() {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [uri, setUri] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const areaRef = useRef<Area | null>(null);
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);

  useEffect(() => {
    openCropper = (next) =>
      new Promise<Blob | null>((resolve) => {
        resolveRef.current = resolve;
        areaRef.current = null;
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setUri(next);
      });
    return () => {
      openCropper = null;
    };
  }, []);

  const finish = useCallback((blob: Blob | null) => {
    resolveRef.current?.(blob);
    resolveRef.current = null;
    setBusy(false);
    setUri(null);
  }, []);

  const onConfirm = useCallback(async () => {
    if (!uri || !areaRef.current) {
      finish(null);
      return;
    }
    setBusy(true);
    try {
      finish(await cropToBlob(uri, areaRef.current));
    } catch {
      finish(null);
    }
  }, [uri, finish]);

  if (!uri) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        backgroundColor: '#000000',
      }}
    >
      <View style={{ flex: 1, position: 'relative' }}>
        <Cropper
          image={uri}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_area, areaPixels) => {
            areaRef.current = areaPixels;
          }}
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          backgroundColor: '#000000',
        }}
      >
        <View style={{ flex: 1 }}>
          <Button variant="secondary" fullWidth onPress={() => finish(null)} disabled={busy}>
            {t('common.cancel')}
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button variant="primary" fullWidth onPress={onConfirm} loading={busy}>
            {t('imageCrop.confirm')}
          </Button>
        </View>
      </View>
    </View>
  );
}
