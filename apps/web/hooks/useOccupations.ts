'use client'

import { useCallback, useEffect, useState } from 'react'
import { getOccupations } from '@cultuvilla/shared/services/occupationService'
import type { OccupationData } from '@cultuvilla/shared/models/occupation'

export function useOccupations() {
  const [occupations, setOccupations] = useState<(OccupationData & { id: string })[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setOccupations(await getOccupations())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { occupations, loading, reload: load }
}
