'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Star, X } from 'lucide-react';
import {
  uploadMunicipalityImage,
  deleteImageByURL,
} from '@cultuvilla/shared/services/imageService';

interface VillageImagesInputProps {
  municipalityId: string;
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}

export function VillageImagesInput({
  municipalityId,
  value,
  onChange,
  max = 5,
}: VillageImagesInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const remaining = max - value.length;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');

    const slots = Math.min(files.length, remaining);
    if (files.length > remaining) {
      setError(`Solo puedes subir ${remaining} imagen(es) más`);
    }

    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < slots; i++) {
        const file = files[i];
        const url = await uploadMunicipalityImage(municipalityId, {
          blob: file,
          filename: file.name,
          contentType: file.type,
        });
        newUrls.push(url);
      }
      onChange([...value, ...newUrls]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error subiendo imagen');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = async (idx: number) => {
    const url = value[idx];
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
    try {
      await deleteImageByURL(url);
    } catch {
      // best-effort cleanup; don't block UI
    }
  };

  const setAsCover = (idx: number) => {
    if (idx === 0) return;
    const next = [value[idx], ...value.filter((_, i) => i !== idx)];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs text-gray-500">
          Imágenes ({value.length}/{max})
        </label>
        <span className="text-xs text-gray-400">La primera se usa como portada</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {value.map((url, idx) => (
          <div
            key={url}
            className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group"
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
            {idx === 0 && (
              <span className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Star size={10} fill="currentColor" /> Portada
              </span>
            )}
            <div className="absolute top-1 right-1 flex gap-1">
              {idx !== 0 && (
                <button
                  type="button"
                  onClick={() => setAsCover(idx)}
                  className="bg-white/90 hover:bg-white rounded-full p-1 shadow"
                  aria-label="Marcar como portada"
                  title="Marcar como portada"
                >
                  <Star size={12} className="text-gray-600" />
                </button>
              )}
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="bg-white/90 hover:bg-white rounded-full p-1 shadow"
                aria-label="Eliminar imagen"
              >
                <X size={12} className="text-red-600" />
              </button>
            </div>
          </div>
        ))}

        {value.length < max && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 disabled:opacity-50"
          >
            <ImagePlus size={20} />
            <span className="text-xs mt-1">{uploading ? 'Subiendo...' : 'Añadir'}</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
