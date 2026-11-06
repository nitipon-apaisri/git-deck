import { useCallback, useEffect, useReducer, useState } from 'react'
import { emptyResource, resourceReducer } from '../lib/resource'
import { errorMessage } from '../lib/errors'
import type { DiffRequest, FileDiff, RepoStatus } from '@shared/types'

// Like the hooks in repoData.ts: the key is an argument and the state stays in the
// calling component, so two panes never share a status or a diff.

export interface StatusState {
  status: RepoStatus | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Status of a linked folder. Reads again whenever `reloadToken` changes and whenever the
 * tab becomes `active`, because files may have changed outside GitDeck meanwhile.
 */
export function useStatus(path: string | null, reloadToken: number, active: boolean): StatusState {
  const [state, dispatch] = useReducer(resourceReducer<RepoStatus>, emptyResource<RepoStatus>())
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (path === null || !active) return
    let cancelled = false
    void (async () => {
      dispatch({ type: 'start', key: path })
      try {
        const status = await window.api.local.status(path)
        if (!cancelled)
          dispatch({ type: 'data', key: path, data: status, fetchedAt: null, done: true })
      } catch (err) {
        if (!cancelled) dispatch({ type: 'failed', key: path, error: errorMessage(err) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, active, reloadToken, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  if (path === null || state.key !== path) {
    return { status: null, loading: path !== null && active, error: null, reload }
  }
  return { status: state.data, loading: state.loading, error: state.error, reload }
}

export interface DiffState {
  diff: FileDiff | null
  loading: boolean
  error: string | null
  reload: () => void
}

const diffKey = (path: string, r: DiffRequest): string =>
  [path, r.source, r.hash ?? '', r.path].join('\n')

/** One file's diff. `request` of `null` loads nothing. */
export function useDiff(
  path: string | null,
  request: DiffRequest | null,
  reloadToken = 0
): DiffState {
  const [state, dispatch] = useReducer(resourceReducer<FileDiff>, emptyResource<FileDiff>())
  const [nonce, setNonce] = useState(0)
  const source = request?.source
  const file = request?.path
  const hash = request?.hash
  const key = path !== null && source && file ? diffKey(path, { source, path: file, hash }) : null

  useEffect(() => {
    if (path === null || !source || !file || key === null) return
    let cancelled = false
    void (async () => {
      dispatch({ type: 'start', key })
      try {
        const diff = await window.api.local.diff(path, { source, path: file, hash })
        if (!cancelled) dispatch({ type: 'data', key, data: diff, fetchedAt: null, done: true })
      } catch (err) {
        if (!cancelled) dispatch({ type: 'failed', key, error: errorMessage(err) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, source, file, hash, key, reloadToken, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  if (key === null || state.key !== key) {
    return { diff: null, loading: key !== null, error: null, reload }
  }
  return { diff: state.data, loading: state.loading, error: state.error, reload }
}
