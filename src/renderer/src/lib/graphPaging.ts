// Paging state for one commit graph. A pure reducer: every action carries the
// generation it was started in, and one from an older generation is dropped. That is
// what keeps a reload or a path change from being overwritten by a late page.
import type { GraphRow } from '../../../shared/graph-layout'

export interface GraphPaging {
  /** The generation the rows belong to. Bumped by every `reset`. */
  gen: number
  /** The folder the rows were read from, `null` before the first reset. */
  path: string | null
  rows: GraphRow[]
  loading: boolean
  /** The last page came back short, so there is nothing more to load. */
  done: boolean
  error: string | null
}

export type GraphPagingAction =
  | { type: 'reset'; gen: number; path: string | null }
  | { type: 'loading'; gen: number }
  | { type: 'page'; gen: number; rows: GraphRow[]; requested: number }
  | { type: 'failed'; gen: number; error: string }

export const emptyPaging = (): GraphPaging => ({
  gen: 0,
  path: null,
  rows: [],
  loading: false,
  done: false,
  error: null
})

export function pagingReducer(state: GraphPaging, action: GraphPagingAction): GraphPaging {
  if (action.type === 'reset') {
    return {
      gen: action.gen,
      path: action.path,
      rows: [],
      loading: action.path !== null,
      done: false,
      error: null
    }
  }
  if (action.gen !== state.gen) return state
  switch (action.type) {
    case 'loading':
      return { ...state, loading: true, error: null }
    case 'page':
      return {
        ...state,
        // A page shorter than asked for is the last one. An empty repository ends here too.
        rows: action.rows.length === 0 ? state.rows : [...state.rows, ...action.rows],
        loading: false,
        done: action.rows.length < action.requested,
        error: null
      }
    case 'failed':
      // Keep what was loaded, and stop: a failed page is not retried by scrolling.
      return { ...state, loading: false, error: action.error }
  }
}
