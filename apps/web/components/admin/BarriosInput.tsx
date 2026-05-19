'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface BarriosInputProps {
  value: string[];
  onChange: (barrios: string[]) => void;
}

export function BarriosInput({ value, onChange }: BarriosInputProps) {
  const [draft, setDraft] = useState('');

  const addBarrio = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setDraft('');
      return;
    }
    onChange([...value, trimmed]);
    setDraft('');
  };

  const removeBarrio = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBarrio();
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs text-gray-500">Barrios</label>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nombre del barrio"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={addBarrio}
          disabled={!draft.trim()}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50"
        >
          Añadir
        </button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((barrio, idx) => (
            <span
              key={`${barrio}-${idx}`}
              className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full"
            >
              {barrio}
              <button
                type="button"
                onClick={() => removeBarrio(idx)}
                className="hover:bg-blue-100 rounded-full p-0.5"
                aria-label={`Eliminar ${barrio}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
