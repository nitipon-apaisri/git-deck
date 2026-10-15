import { useCallback, useEffect, useRef, useState } from 'react'
import type { Cached, RepoSummary } from '@shared/types'
import { errorMessage } from '../lib/errors'

/** Shows the cached summary immediately, then refreshes in the background. */
export function useSummary(repoKey: string): {
  summary: Cached<RepoSummary> | null
  loading: boolean
  error: string | null
  reload: () => void
} {
  const [summary, setSummary] = useState<Cached<RepoSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const gen = useRef(0)

  const load = useCallback(
    async (useCache: boolean): Promise<void> => {
      const id = ++gen.current
      setLoading(true)
      setError(null)
      if (useCache) {
        const cached = await window.api.summary.cached(repoKey).catch(() => null)
        if (id !== gen.current) return
        setSummary(cached)
      }
      try {
        const fresh = await window.api.summary.fetch(repoKey)
        if (id === gen.current) setSummary(fresh)
      } catch (e) {
        if (id === gen.current) setError(errorMessage(e))
      } finally {
        if (id === gen.current) setLoading(false)
      }
    },
    [repoKey]
  )

  useEffect(() => {
    setSummary(null)
    void load(true)
    return () => {
      gen.current++
    }
  }, [load])

  return { summary, loading, error, reload: () => void load(false) }
}
