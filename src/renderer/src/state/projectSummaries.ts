import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { Cached, RepoSummary } from '@shared/types'
import { errorMessage } from '../lib/errors'
import { runPool } from '../lib/pool'
import { SUMMARY_CONCURRENCY, staleKeys, type LoadProgress } from '../lib/projectRows'
import { emptySummaries, progressOf, summaryReducer } from '../lib/summaryStore'

export interface ProjectSummaries {
  entries: Record<string, Cached<RepoSummary>>
  failed: Record<string, string>
  /** Keys still waiting for a summary. */
  pending: ReadonlySet<string>
  /** `null` when nothing is loading. */
  progress: LoadProgress | null
  /** Fetch every available repository again, ignoring how fresh its summary is. */
  refreshAll: () => void
}

/**
 * Summaries for a project's repositories. Cached ones show at once. Missing ones and
 * ones older than an hour load in the background, three at a time. `available` holds the
 * keys that a loaded repository list still has: others cannot be fetched.
 */
export function useProjectSummaries(
  keys: readonly string[],
  available: ReadonlySet<string>
): ProjectSummaries {
  const [store, dispatch] = useReducer(summaryReducer, undefined, emptySummaries)
  const entriesRef = useRef(store.entries)
  useEffect(() => {
    entriesRef.current = store.entries
  })
  // Bumped to cancel the run in progress: its remaining items are not started.
  const generation = useRef(0)

  const fetchKeys = useCallback(async (todo: string[], gen: number): Promise<void> => {
    dispatch({ type: 'batch', keys: todo })
    await runPool(
      todo,
      async (key) => {
        try {
          const entry = await window.api.summary.fetch(key)
          if (gen === generation.current) dispatch({ type: 'fetched', key, entry })
        } catch (err) {
          if (gen === generation.current) {
            dispatch({ type: 'failed', key, error: errorMessage(err) })
          }
        }
      },
      { limit: SUMMARY_CONCURRENCY, cancelled: () => gen !== generation.current }
    )
  }, [])

  const keyList = keys.join('\n')
  const availableList = keys.filter((k) => available.has(k)).join('\n')

  useEffect(() => {
    generation.current += 1
    const gen = generation.current
    const wanted = keyList === '' ? [] : keyList.split('\n')
    const usable = new Set(availableList === '' ? [] : availableList.split('\n'))
    void (async () => {
      const found: Record<string, Cached<RepoSummary>> = {}
      await Promise.all(
        wanted.map(async (key) => {
          if (entriesRef.current[key]) return
          try {
            const cached = await window.api.summary.cached(key)
            if (cached) found[key] = cached
          } catch {
            // A missing or unreadable cache is not an error: the fetch fills it.
          }
        })
      )
      if (gen !== generation.current) return
      dispatch({ type: 'cached', entries: found })
      const known = { ...entriesRef.current, ...found }
      await fetchKeys(staleKeys(wanted, known, Date.now(), usable), gen)
    })()
    return () => {
      generation.current += 1
    }
  }, [keyList, availableList, fetchKeys])

  const refreshAll = useCallback(() => {
    generation.current += 1
    const todo = availableList === '' ? [] : availableList.split('\n')
    void fetchKeys(todo, generation.current)
  }, [availableList, fetchKeys])

  const pending = useMemo(() => new Set(store.pending), [store.pending])
  return {
    entries: store.entries,
    failed: store.failed,
    pending,
    progress: progressOf(store),
    refreshAll
  }
}
