'use client'

import { useCallback, useEffect, useState } from 'react'
import { getCemeteries } from '@cultuvilla/shared/services/municipalityService'
import type { CemeteryData } from '@cultuvilla/shared/models/municipality'

export function useCemeteries(municipalityId: string | null) {
  const [cemeteries, setCemeteries] = useState<(CemeteryData & { id: string })[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!municipalityId) { setCemeteries([]); setLoading(false); return }
    setLoading(true)
    try {
      setCemeteries(await getCemeteries(municipalityId))
    } finally {
      setLoading(false)
    }
  }, [municipalityId])

  useEffect(() => { load() }, [load])

  return { cemeteries, loading, reload: load }
}
