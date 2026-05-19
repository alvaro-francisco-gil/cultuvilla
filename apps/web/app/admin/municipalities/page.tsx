'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { isAppAdmin } from '@cultuvilla/shared/services/adminService'
import { useMunicipalities } from '@/hooks/useMunicipalities'
import {
  createMunicipality,
  updateMunicipality,
  deleteMunicipality,
} from '@cultuvilla/shared/services/municipalityService'
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality'
import { TopBar } from '@/components/common/TopBar'
import { Plus, Pencil, Trash2, MapPin, ChevronRight } from 'lucide-react'

type Status = 'checking' | 'allowed'

type EditForm = {
  name: string
  province: string
  comunidadAutonoma: string
  codigoINE: string
}

const emptyForm = (): EditForm => ({
  name: '',
  province: '',
  comunidadAutonoma: '',
  codigoINE: '',
})

export default function MunicipalitiesAdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<Status>('checking')
  const { municipalities, loading: listLoading, reload } = useMunicipalities()

  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<EditForm>(emptyForm())
  const [addSaving, setAddSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>(emptyForm())
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    isAppAdmin(user.uid).then((ok) => {
      if (ok) setStatus('allowed')
      else router.replace('/')
    })
  }, [user, loading, router])

  if (loading || status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.name.trim() || !addForm.province.trim() || !addForm.comunidadAutonoma.trim() || !addForm.codigoINE.trim()) return
    setAddSaving(true)
    try {
      await createMunicipality({
        name: addForm.name.trim(),
        province: addForm.province.trim(),
        comunidadAutonoma: addForm.comunidadAutonoma.trim(),
        codigoINE: addForm.codigoINE.trim(),
      })
      setAddForm(emptyForm())
      setShowAdd(false)
      reload()
    } finally {
      setAddSaving(false)
    }
  }

  const startEdit = (m: MunicipalityData & { id: string }) => {
    setEditingId(m.id)
    setEditForm({
      name: m.name,
      province: m.province,
      comunidadAutonoma: m.comunidadAutonoma,
      codigoINE: m.codigoINE,
    })
  }

  const handleEdit = async (e: React.FormEvent, id: string) => {
    e.preventDefault()
    if (!editForm.name.trim() || !editForm.province.trim() || !editForm.comunidadAutonoma.trim() || !editForm.codigoINE.trim()) return
    setEditSaving(true)
    try {
      await updateMunicipality(id, {
        name: editForm.name.trim(),
        province: editForm.province.trim(),
        comunidadAutonoma: editForm.comunidadAutonoma.trim(),
        codigoINE: editForm.codigoINE.trim(),
      })
      setEditingId(null)
      reload()
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar el municipio "${name}"?`)) return
    await deleteMunicipality(id)
    reload()
  }

  return (
    <>
      <TopBar title="Municipios" />
      <div className="p-4 space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Municipios</h2>
            {!showAdd ? (
              <button
                onClick={() => setShowAdd(true)}
                className="text-sm text-blue-600 flex items-center gap-1"
              >
                <Plus size={14} /> Añadir
              </button>
            ) : (
              <button onClick={() => { setShowAdd(false); setAddForm(emptyForm()) }} className="text-sm text-gray-500">
                Cerrar formulario
              </button>
            )}
          </div>

          {showAdd && (
            <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Nuevo municipio</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Provincia *</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={addForm.province}
                    onChange={e => setAddForm(f => ({ ...f, province: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Comunidad Autónoma *</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={addForm.comunidadAutonoma}
                    onChange={e => setAddForm(f => ({ ...f, comunidadAutonoma: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Código INE *</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={addForm.codigoINE}
                    onChange={e => setAddForm(f => ({ ...f, codigoINE: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setAddForm(emptyForm()) }}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addSaving}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-60"
                >
                  {addSaving ? 'Guardando...' : 'Añadir'}
                </button>
              </div>
            </form>
          )}

          {listLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : municipalities.length === 0 ? (
            <p className="text-sm text-gray-500">No hay municipios.</p>
          ) : (
            <ul className="space-y-2">
              {municipalities.map((m) =>
                editingId === m.id ? (
                  <li key={m.id} className="bg-white border border-blue-200 rounded-xl p-4">
                    <form onSubmit={e => handleEdit(e, m.id)} className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700">Editar municipio</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
                          <input
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Provincia *</label>
                          <input
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            value={editForm.province}
                            onChange={e => setEditForm(f => ({ ...f, province: e.target.value }))}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Comunidad Autónoma *</label>
                          <input
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            value={editForm.comunidadAutonoma}
                            onChange={e => setEditForm(f => ({ ...f, comunidadAutonoma: e.target.value }))}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Código INE *</label>
                          <input
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            value={editForm.codigoINE}
                            onChange={e => setEditForm(f => ({ ...f, codigoINE: e.target.value }))}
                            required
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={editSaving}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-60"
                        >
                          {editSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </form>
                  </li>
                ) : (
                  <li key={m.id} className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                      <MapPin size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{m.name}</p>
                      <p className="text-xs text-gray-500 truncate">{m.province} · INE: {m.codigoINE}</p>
                    </div>
                    <div className="flex gap-1 items-center">
                      <button
                        onClick={() => startEdit(m)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id, m.name)}
                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                      <Link
                        href={`/admin/municipalities/${m.id}`}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg flex items-center"
                        title="Gestionar barrios y cementerios"
                      >
                        <ChevronRight size={15} />
                      </Link>
                    </div>
                  </li>
                )
              )}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
