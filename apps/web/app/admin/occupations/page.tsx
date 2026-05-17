'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { isAppAdmin } from '@cultuvilla/shared/services/adminService'
import { useOccupations } from '@/hooks/useOccupations'
import {
  createOccupation,
  updateOccupation,
  deleteOccupation,
  getPendingProposals,
  reviewProposal,
} from '@cultuvilla/shared/services/occupationService'
import { getUserProfile } from '@cultuvilla/shared/services/userService'
import type { OccupationProposalData } from '@cultuvilla/shared/models/occupation'
import { TopBar } from '@/components/common/TopBar'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

type Status = 'checking' | 'allowed'

export default function OccupationsAdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<Status>('checking')

  const { occupations, loading: occupationsLoading, reload: reloadOccupations } = useOccupations()

  const [proposals, setProposals] = useState<(OccupationProposalData & { id: string })[]>([])
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [proposerNames, setProposerNames] = useState<Record<string, string>>({})

  // Occupation add state
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  // Occupation edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Review state
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    isAppAdmin(user.uid).then((ok) => {
      if (ok) setStatus('allowed')
      else router.replace('/')
    })
  }, [user, loading, router])

  const loadProposals = async () => {
    setProposalsLoading(true)
    try {
      const fetched = await getPendingProposals()
      setProposals(fetched)
      const uniqueUids = [...new Set(fetched.map(p => p.proposedBy))]
      const profiles = await Promise.all(uniqueUids.map(uid => getUserProfile(uid)))
      const nameMap: Record<string, string> = {}
      uniqueUids.forEach((uid, i) => {
        nameMap[uid] = profiles[i]?.displayName ?? uid
      })
      setProposerNames(nameMap)
    } finally {
      setProposalsLoading(false)
    }
  }

  useEffect(() => {
    if (status !== 'allowed') return
    loadProposals()
  }, [status])

  if (loading || status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addName.trim() || !user) return
    setAddSaving(true)
    try {
      await createOccupation({ name: addName.trim(), createdBy: user.uid })
      setAddName('')
      setShowAdd(false)
      reloadOccupations()
    } finally {
      setAddSaving(false)
    }
  }

  const startEdit = (id: string, name: string) => {
    setEditingId(id)
    setEditName(name)
  }

  const handleEdit = async (e: React.FormEvent, id: string) => {
    e.preventDefault()
    if (!editName.trim()) return
    setEditSaving(true)
    try {
      await updateOccupation(id, { name: editName.trim() })
      setEditingId(null)
      reloadOccupations()
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar la ocupación "${name}"?`)) return
    await deleteOccupation(id)
    reloadOccupations()
  }

  const handleApprove = async (proposal: OccupationProposalData & { id: string }) => {
    if (!user) return
    setReviewingId(proposal.id)
    try {
      const occId = await createOccupation({ name: proposal.name, createdBy: user.uid })
      await reviewProposal(proposal.id, 'approved', user.uid, occId)
      reloadOccupations()
      await loadProposals()
    } finally {
      setReviewingId(null)
    }
  }

  const handleReject = async (proposalId: string) => {
    if (!user) return
    setReviewingId(proposalId)
    try {
      await reviewProposal(proposalId, 'rejected', user.uid)
      await loadProposals()
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <>
      <TopBar title="Ocupaciones" />
      <div className="p-4 space-y-8">

        {/* Approved occupations section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Ocupaciones aprobadas</h2>
            {!showAdd ? (
              <button
                onClick={() => setShowAdd(true)}
                className="text-sm text-blue-600 flex items-center gap-1"
              >
                <Plus size={14} /> Añadir
              </button>
            ) : (
              <button onClick={() => { setShowAdd(false); setAddName('') }} className="text-sm text-gray-500">
                Cerrar formulario
              </button>
            )}
          </div>

          {showAdd && (
            <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Nueva ocupación</h3>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setAddName('') }}
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

          {occupationsLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : occupations.length === 0 ? (
            <p className="text-sm text-gray-500">No hay ocupaciones.</p>
          ) : (
            <ul className="space-y-2">
              {occupations.map(o =>
                editingId === o.id ? (
                  <li key={o.id} className="bg-white border border-blue-200 rounded-xl p-4">
                    <form onSubmit={e => handleEdit(e, o.id)} className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700">Editar ocupación</h3>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
                        <input
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          required
                        />
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
                  <li key={o.id} className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{o.name}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(o.id, o.name)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(o.id, o.name)}
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

        {/* Pending proposals section */}
        <section className="space-y-3">
          <h2 className="font-semibold">Propuestas pendientes</h2>

          {proposalsLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : proposals.length === 0 ? (
            <p className="text-sm text-gray-500">No hay propuestas pendientes.</p>
          ) : (
            <ul className="space-y-2">
              {proposals.map(p => (
                <li key={p.id} className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {proposerNames[p.proposedBy] ?? p.proposedBy}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{p.proposedBy}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleApprove(p)}
                      disabled={reviewingId === p.id}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-60"
                      title="Aprobar"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      onClick={() => handleReject(p.id)}
                      disabled={reviewingId === p.id}
                      className="p-2 text-red-400 hover:bg-red-50 rounded-lg disabled:opacity-60"
                      title="Rechazar"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
