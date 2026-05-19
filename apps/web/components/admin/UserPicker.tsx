'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAllUsers } from '@cultuvilla/shared/services/userService';
import type { UserData } from '@cultuvilla/shared/models/user';

type UserItem = UserData & { id: string };

interface UserPickerProps {
  value: string;
  onChange: (userId: string) => void;
  label?: string;
}

export function UserPicker({ value, onChange, label = 'Administrador del pueblo' }: UserPickerProps) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllUsers()
      .then((list) => setUsers(list))
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(() => users.find((u) => u.id === value), [users, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  return (
    <div className="space-y-2">
      <label className="block text-xs text-gray-500">{label}</label>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
      >
        {selected ? (
          <span>
            <span className="font-medium">{selected.displayName}</span>
            <span className="text-gray-400"> · {selected.email}</span>
          </span>
        ) : (
          <span className="text-gray-400">{loading ? 'Cargando...' : 'Selecciona un usuario'}</span>
        )}
        <span className="text-gray-400">▾</span>
      </button>

      {open && (
        <div className="border border-gray-200 rounded-lg bg-white shadow-sm max-h-64 overflow-hidden flex flex-col">
          <input
            type="text"
            placeholder="Buscar por nombre o email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border-b border-gray-200 focus:outline-none"
            autoFocus
          />
          <ul className="overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">Sin resultados</li>
            ) : (
              filtered.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(u.id);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                      u.id === value ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="font-medium">{u.displayName}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
