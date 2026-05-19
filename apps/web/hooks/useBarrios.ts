'use client'

import { useCallback, useEffect, useState } from 'react'
import { getBarrios } from '@cultuvilla/shared/services/municipalityService'
import type { BarrioData } from '@cultuvilla/shared/models/municipality'

export function useBarrios(municipalityId: string | null) {
  const [barrios, setBarrios] = useState<(BarrioData & { id: string })[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!municipalityId) { setBarrios([]); setLoading(false); return }
    setLoading(true)
    try {
      setBarrios(await getBarrios(municipalityId))
    } finally {
      setLoading(false)
    }
  }, [municipalityId])

  useEffect(() => { load() }, [load])

  return { barrios, loading, reload: load }
}
