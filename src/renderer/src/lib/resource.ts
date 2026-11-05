// A value loaded for one key (a repo key or a folder path), as a pure reducer.
// The key guard drops results that arrive after the pane moved on to another key,
// so a slow response can never paint over the current one. No DOM: runs under tsx.

export interface Resource<T> {
  /** What `data` belongs to. `null` when nothing is being shown. */
  key: string | null
  data: T | null
  /** When `data` was fetched, if the source says so. */
  fetchedAt: number | null
  loading: boolean
  /** Plain message, or `null`. Old data stays visible when a refresh fails. */
  error: string | null
}

export type ResourceAction<T> =
  | { type: 'reset' }
  | { type: 'start'; key: string }
  /** `done: false` is a cached value shown while the network answer is on its way. */
  | { type: 'data'; key: string; data: T; fetchedAt: number | null; done: boolean }
  | { type: 'failed'; key: string; error: string }

export function emptyResource<T>(): Resource<T> {
  return { key: null, data: null, fetchedAt: null, loading: false, error: null }
}

export function resourceReducer<T>(state: Resource<T>, action: ResourceAction<T>): Resource<T> {
  switch (action.type) {
    case 'reset':
      return emptyResource<T>()
    case 'start':
      // Same key: a reload keeps what is on screen. New key: start clean.
      return action.key === state.key
        ? { ...state, loading: true, error: null }
        : { key: action.key, data: null, fetchedAt: null, loading: true, error: null }
    case 'data':
      if (action.key !== state.key) return state
      return {
        ...state,
        data: action.data,
        fetchedAt: action.fetchedAt,
        loading: !action.done,
        error: action.done ? null : state.error
      }
    case 'failed':
      if (action.key !== state.key) return state
      return { ...state, loading: false, error: action.error }
  }
}
