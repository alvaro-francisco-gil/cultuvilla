'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { isAppAdmin } from '@cultuvilla/shared/services/adminService'
import { getMunicipality, createBarrio, updateBarrio, deleteBarrio, createCemetery, updateCemetery, deleteCemetery } from '@cultuvilla/shared/services/municipalityService'
import { useBarrios } from '@/hooks/useBarrios'
import { useCemeteries } from '@/hooks/useCemeteries'
import type { MunicipalityData, BarrioData, CemeteryData } from '@cultuvilla/shared/models/municipality'
import { TopBar } from '@/components/common/TopBar'
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react'

type Status = 'checking' | 'allowed'

export default function MunicipalityDetailPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const municipalityId = params.id

  const [status, setStatus] = useState<Status>('checking')
  const [municipality, setMunicipality] = useState<(MunicipalityData & { id: string }) | null>(null)
  const [muniLoading, setMuniLoading] = useState(true)

  const { barrios, loading: barriosLoading, reload: reloadBarrios } = useBarrios(status === 'allowed' ? municipalityId : null)
  const { cemeteries, loading: cemeteriesLoading, reload: reloadCemeteries } = useCemeteries(status === 'allowed' ? municipalityId : null)

  // Barrio add state
  const [showAddBarrio, setShowAddBarrio] = useState(false)
  const [barrioName, setBarrioName] = useState('')
  const [barrioSaving, setBarrioSaving] = useState(false)

  // Barrio edit state
  const [editingBarrioId, setEditingBarrioId] = useState<string | null>(null)
  const [editBarrioName, setEditBarrioName] = useState('')
  const [editBarrioSaving, setEditBarrioSaving] = useState(false)

  // Cemetery add state
  const [showAddCemetery, setShowAddCemetery] = useState(false)
  const [cemeteryForm, setCemeteryForm] = useState({ name: '', description: '' })
  const [cemeterySaving, setCemeterySaving] = useState(false)

  // Cemetery edit state
  const [editingCemeteryId, setEditingCemeteryId] = useState<string | null>(null)
  const [editCemeteryForm, setEditCemeteryForm] = useState({ name: '', description: '' })
  const [editCemeterySaving, setEditCemeterySaving] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    isAppAdmin(user.uid).then((ok) => {
      if (ok) setStatus('allowed')
      else router.replace('/')
    })
  }, [user, loading, router])

  useEffect(() => {
    if (status !== 'allowed') return
    setMuniLoading(true)
    getMunicipality(municipalityId).then(m => {
      setMunicipality(m)
      setMuniLoading(false)
    })
  }, [status, municipalityId])

  if (loading || status === 'checking' || muniLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  if (!municipality) {
    return (
      <div className="p-4">
        <p className="text-red-500">Municipio no encontrado.</p>
        <Link href="/admin/municipalities" className="text-blue-600 text-sm mt-2 block">Volver</Link>
      </div>
    )
  }

  // Barrio handlers
  const handleAddBarrio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!barrioName.trim()) return
    setBarrioSaving(true)
    try {
      await createBarrio(municipalityId, { name: barrioName.trim(), municipalityId })
      setBarrioName('')
      setShowAddBarrio(false)
      reloadBarrios()
    } finally {
      setBarrioSaving(false)
    }
  }

  const startEditBarrio = (b: BarrioData & { id: string }) => {
    setEditingBarrioId(b.id)
    setEditBarrioName(b.name)
  }

  const handleEditBarrio = async (e: React.FormEvent, id: string) => {
    e.preventDefault()
    if (!editBarrioName.trim()) return
    setEditBarrioSaving(true)
    try {
      await updateBarrio(municipalityId, id, { name: editBarrioName.trim() })
      setEditingBarrioId(null)
      reloadBarrios()
    } finally {
      setEditBarrioSaving(false)
    }
  }

  const handleDeleteBarrio = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar el barrio "${name}"?`)) return
    await deleteBarrio(municipalityId, id)
    reloadBarrios()
  }

  // Cemetery handlers
  const handleAddCemetery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cemeteryForm.name.trim()) return
    setCemeterySaving(true)
    try {
      await createCemetery(municipalityId, {
        name: cemeteryForm.name.trim(),
        description: cemeteryForm.description.trim() || null,
        municipalityId,
      })
      setCemeteryForm({ name: '', description: '' })
      setShowAddCemetery(false)
      reloadCemeteries()
    } finally {
      setCemeterySaving(false)
    }
  }

  const startEditCemetery = (c: CemeteryData & { id: string }) => {
    setEditingCemeteryId(c.id)
    setEditCemeteryForm({ name: c.name, description: c.description ?? '' })
  }

  const handleEditCemetery = async (e: React.FormEvent, id: string) => {
    e.preventDefault()
    if (!editCemeteryForm.name.trim()) return
    setEditCemeterySaving(true)
    try {
      await updateCemetery(municipalityId, id, {
        name: editCemeteryForm.name.trim(),
        description: editCemeteryForm.description.trim() || null,
      })
      setEditingCemeteryId(null)
      reloadCemeteries()
    } finally {
      setEditCemeterySaving(false)
    }
  }

  const handleDeleteCemetery = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar el cementerio "${name}"?`)) return
    await deleteCemetery(municipalityId, id)
    reloadCemeteries()
  }

  return (
    <>
      <TopBar title={municipality.name} />
      <div className="p-4 space-y-6">
        <Link href="/admin/municipalities" className="flex items-center gap-1 text-blue-600 text-sm">
          <ArrowLeft size={16} /> Municipios
        </Link>

        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <p className="text-sm text-gray-700 font-medium">{municipality.name}</p>
          <p className="text-xs text-gray-500">{municipality.province} · {municipality.comunidadAutonoma} · INE: {municipality.codigoINE}</p>
        </div>

        {/* Barrios */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Barrios</h2>
            {!showAddBarrio ? (
              <button
                onClick={() => setShowAddBarrio(true)}
                className="text-sm text-blue-600 flex items-center gap-1"
              >
                <Plus size={14} /> Añadir
              </button>
            ) : (
              <button onClick={() => { setShowAddBarrio(false); setBarrioName('') }} className="text-sm text-gray-500">
                Cerrar formulario
              </button>
            )}
          </div>

          {showAddBarrio && (
            <form onSubmit={handleAddBarrio} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Nuevo barrio</h3>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={barrioName}
                  onChange={e => setBarrioName(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowAddBarrio(false); setBarrioName('') }}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={barrioSaving}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-60"
                >
                  {barrioSaving ? 'Guardando...' : 'Añadir'}
                </button>
              </div>
            </form>
          )}

          {barriosLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : barrios.length === 0 ? (
            <p className="text-sm text-gray-500">No hay barrios.</p>
          ) : (
            <ul className="space-y-2">
              {barrios.map(b =>
                editingBarrioId === b.id ? (
                  <li key={b.id} className="bg-white border border-blue-200 rounded-xl p-4">
                    <form onSubmit={e => handleEditBarrio(e, b.id)} className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700">Editar barrio</h3>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
                        <input
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          value={editBarrioName}
                          onChange={e => setEditBarrioName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingBarrioId(null)}
                          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={editBarrioSaving}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-60"
                        >
                          {editBarrioSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </form>
                  </li>
                ) : (
                  <li key={b.id} className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.name}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEditBarrio(b)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteBarrio(b.id, b.name)}
                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                )
              )}
            </ul>
          )}
        </section>

        {/* Cementerios */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Cementerios</h2>
            {!showAddCemetery ? (
              <button
                onClick={() => setShowAddCemetery(true)}
                className="text-sm text-blue-600 flex items-center gap-1"
              >
                <Plus size={14} /> Añadir
              </button>
            ) : (
              <button onClick={() => { setShowAddCemetery(false); setCemeteryForm({ name: '', description: '' }) }} className="text-sm text-gray-500">
                Cerrar formulario
              </button>
            )}
          </div>

          {showAddCemetery && (
            <form onSubmit={handleAddCemetery} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Nuevo cementerio</h3>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={cemeteryForm.name}
                  onChange={e => setCemeteryForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Descripción</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                  rows={3}
                  value={cemeteryForm.description}
                  onChange={e => setCemeteryForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowAddCemetery(false); setCemeteryForm({ name: '', description: '' }) }}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cemeterySaving}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-60"
                >
                  {cemeterySaving ? 'Guardando...' : 'Añadir'}
                </button>
              </div>
            </form>
          )}

          {cemeteriesLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : cemeteries.length === 0 ? (
            <p className="text-sm text-gray-500">No hay cementerios.</p>
          ) : (
            <ul className="space-y-2">
              {cemeteries.map(c =>
                editingCemeteryId === c.id ? (
                  <li key={c.id} className="bg-white border border-blue-200 rounded-xl p-4">
                    <form onSubmit={e => handleEditCemetery(e, c.id)} className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700">Editar cementerio</h3>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
                        <input
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          value={editCemeteryForm.name}
                          onChange={e => setEditCemeteryForm(f => ({ ...f, name: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Descripción</label>
                        <textarea
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                          rows={3}
                          value={editCemeteryForm.description}
                          onChange={e => setEditCemeteryForm(f => ({ ...f, description: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingCemeteryId(null)}
                          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={editCemeterySaving}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-60"
                        >
                          {editCemeterySaving ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </form>
                  </li>
                ) : (
                  <li key={c.id} className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {c.description && <p className="text-xs text-gray-500 truncate">{c.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEditCemetery(c)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteCemetery(c.id, c.name)}
                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
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
