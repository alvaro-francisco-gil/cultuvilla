'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { isAppAdmin } from '@cultuvilla/shared/services/adminService'
import {
  getPendingOrganizerRequests,
  respondToOrganizerRequest,
} from '@cultuvilla/shared/services/organizerRequestService'
import { getUserProfile } from '@cultuvilla/shared/services/userService'
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService'
import type { OrganizerRequestData } from '@cultuvilla/shared/models/municipality/OrganizerRequestDataModel'
import { TopBar } from '@/components/common/TopBar'
import { Check, X } from 'lucide-react'

type Status = 'checking' | 'allowed'

type RequestRow = OrganizerRequestData & { id: string }

export default function OrganizerRequestsAdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<Status>('checking')

  const [requests, setRequests] = useState<RequestRow[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [userNames, setUserNames] = useState<Record<string, { displayName: string; email: string }>>({})
  const [municipalityNames, setMunicipalityNames] = useState<Record<string, string>>({})

  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    isAppAdmin(user.uid).then((ok) => {
      if (ok) setStatus('allowed')
      else router.replace('/')
    })
  }, [user, loading, router])

  const loadRequests = async () => {
    setRequestsLoading(true)
    try {
      const fetched = await getPendingOrganizerRequests()
      setRequests(fetched)

      const uniqueUids = [...new Set(fetched.map((r) => r.userId))]
      const profiles = await Promise.all(uniqueUids.map((uid) => getUserProfile(uid)))
      const nameMap: Record<string, { displayName: string; email: string }> = {}
      uniqueUids.forEach((uid, i) => {
        const p = profiles[i]
        nameMap[uid] = {
          displayName: p?.displayName ?? uid,
          email: p?.email ?? '',
        }
      })
      setUserNames(nameMap)

      const uniqueMunis = [...new Set(fetched.map((r) => r.municipalityId))]
      const munis = await Promise.all(uniqueMunis.map((mid) => getMunicipality(mid)))
      const muniMap: Record<string, string> = {}
      uniqueMunis.forEach((mid, i) => {
        muniMap[mid] = munis[i]?.name ?? mid
      })
      setMunicipalityNames(muniMap)
    } finally {
      setRequestsLoading(false)
    }
  }

  useEffect(() => {
    if (status !== 'allowed') return
    loadRequests()
  }, [status])

  if (loading || status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  const handleDecision = async (requestId: string, decision: 'approved' | 'rejected') => {
    setReviewingId(requestId)
    setError(null)
    try {
      await respondToOrganizerRequest({ requestId, decision })
      await loadRequests()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <>
      <TopBar title="Solicitudes de organizador" />
      <div className="p-4 space-y-6">
        <section className="space-y-3">
          <h2 className="font-semibold">Solicitudes pendientes</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          {requestsLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-gray-500">No hay solicitudes pendientes.</p>
          ) : (
            <ul className="space-y-2">
              {requests.map((r) => {
                const profile = userNames[r.userId]
                const muniName = municipalityNames[r.municipalityId] ?? r.municipalityId
                const disabled = reviewingId === r.id
                return (
                  <li
                    key={r.id}
                    className="bg-white rounded-lg p-3 border border-gray-200 flex items-start gap-3"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium truncate">
                        {profile?.displayName ?? r.userId}
                      </p>
                      {profile?.email && (
                        <p className="text-xs text-gray-500 truncate">{profile.email}</p>
                      )}
                      <p className="text-xs text-gray-600 truncate">
                        Pueblo: <span className="font-medium">{muniName}</span>
                      </p>
                      {r.motivation && (
                        <p className="text-xs text-gray-700 whitespace-pre-wrap break-words">
                          {r.motivation}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        {r.requestedAt.toLocaleString('es-ES')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDecision(r.id, 'approved')}
                        disabled={disabled}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-60 flex items-center gap-1 text-xs"
                        title="Aprobar"
                      >
                        <Check size={15} /> Aprobar
                      </button>
                      <button
                        onClick={() => handleDecision(r.id, 'rejected')}
                        disabled={disabled}
                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg disabled:opacity-60 flex items-center gap-1 text-xs"
                        title="Rechazar"
                      >
                        <X size={15} /> Rechazar
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
