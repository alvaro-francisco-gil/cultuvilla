'use client'

import { useCallback, useEffect, useState } from 'react'
import { getMunicipalities } from '@cultuvilla/shared/services/municipalityService'
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality'

export function useMunicipalities() {
  const [municipalities, setMunicipalities] = useState<(MunicipalityData & { id: string })[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setMunicipalities(await getMunicipalities())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { municipalities, loading, reload: load }
}
