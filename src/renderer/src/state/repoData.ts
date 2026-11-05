import { useCallback, useEffect, useReducer, useState } from 'react'
import { emptyResource, resourceReducer, type Resource } from '../lib/resource'
import { errorMessage } from '../lib/errors'
import type { LocalInfo, RepoSummary } from '@shared/types'

// Both hooks take their key as an argument and keep their state inside the calling
// component, so two panes showing two repositories never share anything.

export interface RepoSummaryState {
  summary: RepoSummary | null
  /** When the shown summary was fetched, for "updated … ago". */
  fetchedAt: number | null
  loading: boolean
  error: string | null
  reload: () => void
}

/** Cached summary first, then the network answer. `reload` skips the cache. */
export function useRepoSummary(repoKey: string): RepoSummaryState {
  const [state, dispatch] = useReducer(resourceReducer<RepoSummary>, emptyResource<RepoSummary>())
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      dispatch({ type: 'start', key: repoKey })
      if (nonce === 0) {
        try {
          const cached = await window.api.summary.cached(repoKey)
          if (cached && !cancelled) {
            dispatch({
              type: 'data',
              key: repoKey,
              data: cached.data,
              fetchedAt: cached.fetchedAt,
              done: false
            })
          }
        } catch {
          // A missing or unreadable cache is not an error: the fetch below fills it.
        }
      }
      try {
        const fresh = await window.api.summary.fetch(repoKey)
        if (!cancelled) {
          dispatch({
            type: 'data',
            key: repoKey,
            data: fresh.data,
            fetchedAt: fresh.fetchedAt,
            done: true
          })
        }
      } catch (err) {
        if (!cancelled) dispatch({ type: 'failed', key: repoKey, error: errorMessage(err) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [repoKey, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  // For one render after the key changes, `state` still belongs to the old key.
  const current: Resource<RepoSummary> = state.key === repoKey ? state : emptyResource()
  return {
    summary: current.data,
    fetchedAt: current.fetchedAt,
    loading: current.key === null ? true : current.loading,
    error: current.error,
    reload
  }
}

export interface LocalInfoState {
  info: LocalInfo | null
  loading: boolean
  error: string | null
}

/** `LocalInfo` for a linked folder. Loads again whenever `reloadToken` changes. */
export function useLocalInfo(path: string | null, reloadToken: number): LocalInfoState {
  const [state, dispatch] = useReducer(resourceReducer<LocalInfo>, emptyResource<LocalInfo>())

  useEffect(() => {
    if (path === null) return
    let cancelled = false
    void (async () => {
      dispatch({ type: 'start', key: path })
      try {
        const info = await window.api.local.info(path)
        if (!cancelled)
          dispatch({ type: 'data', key: path, data: info, fetchedAt: null, done: true })
      } catch (err) {
        if (!cancelled) dispatch({ type: 'failed', key: path, error: errorMessage(err) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, reloadToken])

  if (path === null || state.key !== path) {
    return { info: null, loading: path !== null, error: null }
  }
  return { info: state.data, loading: state.loading, error: state.error }
}
