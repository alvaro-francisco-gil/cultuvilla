'use client'

import { useCallback, useEffect, useState } from 'react'
import { getPersonsByCreator } from '@cultuvilla/shared/services/personService'
import type { PersonData } from '@cultuvilla/shared/models/person'
import { useAuth } from './useAuth'

export function usePersons() {
  const { user } = useAuth()
  const [persons, setPersons] = useState<(PersonData & { id: string })[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setPersons([]); setLoading(false); return }
    setLoading(true)
    try {
      setPersons(await getPersonsByCreator(user.uid))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  return { persons, loading, reload: load }
}
