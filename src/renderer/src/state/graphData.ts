import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { GraphLayout } from '@shared/graph-layout'
import type { CommitDetail } from '@shared/types'
import { errorMessage } from '../lib/errors'
import { emptyPaging, pagingReducer, type GraphPaging } from '../lib/graphPaging'
import { PAGE_SIZE } from '../lib/graphView'
import { emptyResource, resourceReducer, type Resource } from '../lib/resource'

// Both hooks keep their state inside the calling component, so two panes showing two
// graphs never share a layout, a page counter or a selection.

export interface GraphState {
  rows: GraphPaging['rows']
  loading: boolean
  done: boolean
  error: string | null
  loadMore: () => void
  reload: () => void
}

/**
 * The commit graph of one folder, page by page. One `GraphLayout` lives for one
 * generation: a reload, a new path or a new `reloadToken` starts a fresh layout and a
 * new generation, and a page that arrives for an older one is dropped.
 */
export function useGraph(path: string | null, reloadToken: number): GraphState {
  const [paging, dispatch] = useReducer(pagingReducer, undefined, emptyPaging)
  const [nonce, setNonce] = useState(0)

  const generation = useRef(0)
  const layout = useRef(new GraphLayout())
  const fetched = useRef(0)
  const inflight = useRef(false)

  const loadPage = useCallback(async (folder: string, gen: number): Promise<void> => {
    if (inflight.current) return
    inflight.current = true
    dispatch({ type: 'loading', gen })
    try {
      const commits = await window.api.local.graph(folder, fetched.current, PAGE_SIZE)
      if (gen !== generation.current) return
      fetched.current += commits.length
      const rows = layout.current.add(commits)
      dispatch({ type: 'page', gen, rows, requested: PAGE_SIZE })
    } catch (err) {
      if (gen === generation.current) dispatch({ type: 'failed', gen, error: errorMessage(err) })
    } finally {
      // A newer generation already cleared the flag for itself.
      if (gen === generation.current) inflight.current = false
    }
  }, [])

  useEffect(() => {
    generation.current += 1
    const gen = generation.current
    layout.current = new GraphLayout()
    fetched.current = 0
    inflight.current = false
    dispatch({ type: 'reset', gen, path })
    if (path !== null) void loadPage(path, gen)
  }, [path, reloadToken, nonce, loadPage])

  const loadMore = useCallback(() => {
    if (path !== null) void loadPage(path, generation.current)
  }, [path, loadPage])
  const reload = useCallback(() => setNonce((n) => n + 1), [])

  // For one render after the path changes, `paging` still belongs to the old folder.
  if (paging.path !== path) {
    return { rows: [], loading: path !== null, done: false, error: null, loadMore, reload }
  }
  return {
    rows: paging.rows,
    loading: paging.loading,
    done: paging.done,
    error: paging.error,
    loadMore,
    reload
  }
}

export interface CommitDetailState {
  detail: CommitDetail | null
  loading: boolean
  error: string | null
}

/** Message body and changed files of one commit. `null` when nothing is selected. */
export function useCommitDetail(path: string | null, hash: string | null): CommitDetailState {
  const [state, dispatch] = useReducer(
    resourceReducer<CommitDetail>,
    undefined,
    emptyResource<CommitDetail>
  )
  const key = path !== null && hash !== null ? `${path}\n${hash}` : null

  useEffect(() => {
    if (path === null || hash === null || key === null) return
    let cancelled = false
    void (async () => {
      dispatch({ type: 'start', key })
      try {
        const detail = await window.api.local.commit(path, hash)
        if (!cancelled) dispatch({ type: 'data', key, data: detail, fetchedAt: null, done: true })
      } catch (err) {
        if (!cancelled) dispatch({ type: 'failed', key, error: errorMessage(err) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, hash, key])

  const current: Resource<CommitDetail> = state.key === key ? state : emptyResource()
  if (key === null) return { detail: null, loading: false, error: null }
  return {
    detail: current.data,
    loading: current.key === null ? true : current.loading,
    error: current.error
  }
}
