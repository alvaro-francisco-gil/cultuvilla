'use client'

import { Pencil, Trash2, User } from 'lucide-react'
import type { PersonData } from '@cultuvilla/shared/models/person'
import { buildDisplayName } from '@cultuvilla/shared/models/person'

interface PersonCardProps {
  person: PersonData & { id: string }
  onEdit: () => void
  onDelete: () => void
}

function formatPartialDate(pd: PersonData['birthday']): string | null {
  if (!pd) return null
  if (pd.day && pd.month && pd.year) {
    return new Date(pd.year, pd.month - 1, pd.day).toLocaleDateString('es-ES', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }
  if (pd.month && pd.year) return `${pd.month}/${pd.year}`
  if (pd.year) return String(pd.year)
  return null
}

export function PersonCard({ person, onEdit, onDelete }: PersonCardProps) {
  const displayName = buildDisplayName(person)
  const birthdayStr = formatPartialDate(person.birthday)
  const deathDateStr = formatPartialDate(person.deathDate)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-3">
      {person.photoURL ? (
        <img src={person.photoURL} alt={displayName} className="w-12 h-12 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
          <User size={22} className="text-gray-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900">{displayName}</h3>
        {person.nickname && (
          <p className="text-xs text-blue-600 font-medium">&ldquo;{person.nickname}&rdquo;</p>
        )}
        {birthdayStr && (
          <p className="text-xs text-gray-500 mt-0.5">
            {birthdayStr}{deathDateStr ? ` – ${deathDateStr}` : ''}
          </p>
        )}
        {person.biography && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{person.biography}</p>
        )}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition">
          <Pencil size={15} />
        </button>
        <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
