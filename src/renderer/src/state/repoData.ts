import { useCallback, useEffect, useReducer, useState } from 'react'
import { emptyResource, resourceReducer, type Resource } from '../lib/resource'
import { errorMessage } from '../lib/errors'
import type { BranchList, LocalInfo, OperationState, RepoSummary, StashEntry } from '@shared/types'

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
/** `null` for a repository with no host (a local folder): nothing is loaded. */
export function useRepoSummary(repoKey: string | null): RepoSummaryState {
  const [state, dispatch] = useReducer(resourceReducer<RepoSummary>, emptyResource<RepoSummary>())
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (repoKey === null) return
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
  if (repoKey === null) {
    return { summary: null, fetchedAt: null, loading: false, error: null, reload }
  }
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
  /** Read the folder again. */
  reload: () => void
}

/** `LocalInfo` for a linked folder. Loads again whenever `reloadToken` changes. */
export function useLocalInfo(path: string | null, reloadToken: number): LocalInfoState {
  const [state, dispatch] = useReducer(resourceReducer<LocalInfo>, emptyResource<LocalInfo>())
  const [nonce, setNonce] = useState(0)

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
  }, [path, reloadToken, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  if (path === null || state.key !== path) {
    return { info: null, loading: path !== null, error: null, reload }
  }
  return { info: state.data, loading: state.loading, error: state.error, reload }
}

export interface BranchesState {
  branches: BranchList | null
  error: string | null
}

/**
 * Branches and tracking counts for a linked folder: what the branch menu and the Push and
 * Pull buttons read. Cheap (a few `for-each-ref` calls), so every linked pane keeps it.
 */
export function useBranches(path: string | null, reloadToken: number): BranchesState {
  const [state, dispatch] = useReducer(resourceReducer<BranchList>, emptyResource<BranchList>())

  useEffect(() => {
    if (path === null) return
    let cancelled = false
    void (async () => {
      dispatch({ type: 'start', key: path })
      try {
        const data = await window.api.local.branches(path)
        if (!cancelled) dispatch({ type: 'data', key: path, data, fetchedAt: null, done: true })
      } catch (err) {
        if (!cancelled) dispatch({ type: 'failed', key: path, error: errorMessage(err) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, reloadToken])

  if (path === null || state.key !== path) return { branches: null, error: null }
  return { branches: state.data, error: state.error }
}

export interface StashesState {
  stashes: StashEntry[]
  error: string | null
}

/** The stash list of a linked folder. Reads again whenever `reloadToken` changes. */
export function useStashes(path: string | null, reloadToken: number): StashesState {
  const [state, dispatch] = useReducer(resourceReducer<StashEntry[]>, emptyResource<StashEntry[]>())

  useEffect(() => {
    if (path === null) return
    let cancelled = false
    void (async () => {
      dispatch({ type: 'start', key: path })
      try {
        const data = await window.api.local.stashes(path)
        if (!cancelled) dispatch({ type: 'data', key: path, data, fetchedAt: null, done: true })
      } catch (err) {
        if (!cancelled) dispatch({ type: 'failed', key: path, error: errorMessage(err) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, reloadToken])

  if (path === null || state.key !== path) return { stashes: [], error: null }
  return { stashes: state.data ?? [], error: state.error }
}

export interface OperationStateResult {
  /** The merge, cherry-pick or revert waiting for the user. Found again after a restart. */
  operation: OperationState | null
  error: string | null
}

export function useOperation(path: string | null, reloadToken: number): OperationStateResult {
  const [state, dispatch] = useReducer(
    resourceReducer<OperationState | null>,
    emptyResource<OperationState | null>()
  )

  useEffect(() => {
    if (path === null) return
    let cancelled = false
    void (async () => {
      dispatch({ type: 'start', key: path })
      try {
        const data = await window.api.local.operation(path)
        if (!cancelled) dispatch({ type: 'data', key: path, data, fetchedAt: null, done: true })
      } catch (err) {
        if (!cancelled) dispatch({ type: 'failed', key: path, error: errorMessage(err) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, reloadToken])

  if (path === null || state.key !== path) return { operation: null, error: null }
  return { operation: state.data ?? null, error: state.error }
}
