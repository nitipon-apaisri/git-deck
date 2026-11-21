import { useCallback, useEffect, useReducer, useState } from 'react'
import { emptyResource, resourceReducer, type Resource } from '../lib/resource'
import { changesStale } from '../lib/changeView'
import { errorMessage } from '../lib/errors'
import type { ChangeRequest, ChecksInfo } from '@shared/types'

// Like repoData: the state lives in the calling pane, so two panes share nothing.

export interface ChangeRequestsState {
  items: ChangeRequest[] | null
  fetchedAt: number | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Reads when `enabled` turns on (the tab opens), on `reload`, and on window focus when the
 * data is older than a minute. `null` key (a local repository): nothing is loaded.
 */
export function useChangeRequests(repoKey: string | null, enabled: boolean): ChangeRequestsState {
  const [state, dispatch] = useReducer(
    resourceReducer<ChangeRequest[]>,
    emptyResource<ChangeRequest[]>()
  )
  const [nonce, setNonce] = useState(0)
  const [focusNonce, setFocusNonce] = useState(0)
  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const live = repoKey !== null && enabled

  useEffect(() => {
    if (!live) return
    let cancelled = false
    dispatch({ type: 'start', key: repoKey })
    window.api.changes
      .list(repoKey)
      .then((data) => {
        if (!cancelled)
          dispatch({ type: 'data', key: repoKey, data, fetchedAt: Date.now(), done: true })
      })
      .catch((err: unknown) => {
        if (!cancelled) dispatch({ type: 'failed', key: repoKey, error: errorMessage(err) })
      })
    return () => {
      cancelled = true
    }
  }, [live, repoKey, nonce, focusNonce])

  const fetchedAt = state.key === repoKey ? state.fetchedAt : null
  useEffect(() => {
    if (!live) return
    const onFocus = (): void => {
      if (changesStale(fetchedAt, Date.now())) setFocusNonce((n) => n + 1)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [live, fetchedAt])

  if (repoKey === null) return { items: null, fetchedAt: null, loading: false, error: null, reload }
  const current: Resource<ChangeRequest[]> = state.key === repoKey ? state : emptyResource()
  return {
    items: current.data,
    fetchedAt: current.fetchedAt,
    loading: live && (current.key === null || current.loading),
    error: current.error,
    reload
  }
}

/** CI for one ref. `null` ref or key: nothing is loaded. A failure reads as "no CI info". */
export function useChecks(
  repoKey: string | null,
  ref: string | null,
  token = 0
): ChecksInfo | null {
  const [result, setResult] = useState<{ id: string; info: ChecksInfo } | null>(null)
  const id = `${repoKey}\0${ref}\0${token}`
  useEffect(() => {
    if (repoKey === null || ref === null) return
    let cancelled = false
    window.api.changes
      .checks(repoKey, ref)
      .then((info) => !cancelled && setResult({ id, info }))
      .catch(() => !cancelled && setResult({ id, info: { state: 'none', items: [] } }))
    return () => {
      cancelled = true
    }
  }, [repoKey, ref, id])
  return result?.id === id ? result.info : null
}
