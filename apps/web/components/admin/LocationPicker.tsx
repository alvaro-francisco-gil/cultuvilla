'use client';

import { useEffect, useRef, useState } from 'react';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationValue {
  lat: number;
  lng: number;
  displayName: string;
}

interface LocationPickerProps {
  value: LocationValue | null;
  onChange: (value: LocationValue) => void;
  countryCode?: string;
}

export function LocationPicker({ value, onChange, countryCode = 'es' }: LocationPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '6');
        url.searchParams.set('countrycodes', countryCode);
        url.searchParams.set('addressdetails', '0');

        const res = await fetch(url.toString(), {
          headers: { 'Accept-Language': 'es' },
        });
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, countryCode]);

  const selectResult = (r: NominatimResult) => {
    onChange({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      displayName: r.display_name,
    });
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs text-gray-500">Ubicación</label>

      {value && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
          <div className="font-medium">📍 {value.displayName}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </div>
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          placeholder="Buscar pueblo, ciudad o dirección..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            Buscando...
          </span>
        )}

        {open && results.length > 0 && (
          <ul className="absolute z-10 left-0 right-0 mt-1 border border-gray-200 rounded-lg bg-white shadow-md max-h-60 overflow-y-auto">
            {results.map((r) => (
              <li key={r.place_id}>
                <button
                  type="button"
                  onClick={() => selectResult(r)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
