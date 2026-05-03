'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePersons } from '@/hooks/usePersons'
import { createPerson, updatePerson, deletePerson } from '@villa-events/shared/services/personService'
import { uploadPersonImage } from '@villa-events/shared/services/imageService'
import type { PersonData, PartialDate } from '@villa-events/shared/models/person'
import type { Sex } from '@villa-events/shared/models/person'
import { PersonCard } from '@/components/profile/PersonCard'
import { PersonForm } from '@/components/profile/PersonForm'
import { SkeletonLoader } from '@/components/common/SkeletonLoader'

type FormData = {
  givenName: string
  middleNames: string[]
  firstSurname: string | null
  secondSurname: string | null
  nickname: string | null
  sex: Sex | null
  birthday: PartialDate | null
  deathDate: PartialDate | null
  biography: string | null
  photoFile: File | null
}

export default function PersonsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { persons, loading, reload } = usePersons()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  if (authLoading || loading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLoader className="h-8 w-48" />
        {[1, 2].map(i => <SkeletonLoader key={i} className="h-20 rounded-xl" />)}
      </div>
    )
  }

  if (!user) return null

  const handleAdd = async (data: FormData) => {
    const personId = await createPerson({ ...data, createdBy: user.uid })
    if (data.photoFile) {
      const photoURL = await uploadPersonImage(personId, data.photoFile)
      await updatePerson(personId, { photoURL })
    }
    setShowAddForm(false)
    reload()
  }

  const handleEdit = async (personId: string, data: FormData) => {
    let photoURL: string | undefined
    if (data.photoFile) {
      photoURL = await uploadPersonImage(personId, data.photoFile)
    }
    await updatePerson(personId, {
      givenName: data.givenName,
      middleNames: data.middleNames,
      firstSurname: data.firstSurname,
      secondSurname: data.secondSurname,
      nickname: data.nickname,
      sex: data.sex,
      birthday: data.birthday,
      deathDate: data.deathDate,
      biography: data.biography,
      ...(photoURL !== undefined && { photoURL }),
    })
    setEditingId(null)
    reload()
  }

  const handleDelete = async (personId: string) => {
    if (!confirm('¿Eliminar esta persona?')) return
    await deletePerson(personId)
    reload()
  }

  return (
    <div className="px-4 py-6">
      <Link href="/profile" className="flex items-center gap-1 text-blue-600 text-sm mb-4">
        <ArrowLeft size={16} /> Mi perfil
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Personas</h1>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
          >
            <Plus size={16} /> Añadir
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Nueva persona</h2>
          <PersonForm
            onSubmit={handleAdd}
            onCancel={() => setShowAddForm(false)}
            submitLabel="Añadir"
          />
        </div>
      )}

      {persons.length === 0 && !showAddForm ? (
        <p className="text-gray-500 text-center py-12 text-sm">No has añadido ninguna persona todavía.</p>
      ) : (
        <div className="space-y-3">
          {persons.map(person =>
            editingId === person.id ? (
              <div key={person.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Editar</h2>
                <PersonForm
                  initial={person}
                  onSubmit={data => handleEdit(person.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <PersonCard
                key={person.id}
                person={person}
                onEdit={() => setEditingId(person.id)}
                onDelete={() => handleDelete(person.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}
