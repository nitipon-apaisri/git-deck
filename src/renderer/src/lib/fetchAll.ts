// "Fetch all linked": the per-repository result list as a pure reducer. No DOM.

export type FetchStatus = 'queued' | 'running' | 'done' | 'failed'

export interface FetchTarget {
  key: string
  name: string
  /** The linked folder. */
  path: string
}

export interface FetchItem extends FetchTarget {
  status: FetchStatus
  /** Plain message when `status` is `failed`. */
  error: string | null
}

export interface FetchAllState {
  /** Empty when no run is shown. */
  items: FetchItem[]
}

export type FetchAllAction =
  | { type: 'start'; targets: FetchTarget[] }
  | { type: 'running'; key: string }
  | { type: 'done'; key: string }
  | { type: 'failed'; key: string; error: string }
  | { type: 'close' }

export const emptyFetchAll = (): FetchAllState => ({ items: [] })

function setItem(state: FetchAllState, key: string, change: Partial<FetchItem>): FetchAllState {
  return { items: state.items.map((i) => (i.key === key ? { ...i, ...change } : i)) }
}

export function fetchAllReducer(state: FetchAllState, action: FetchAllAction): FetchAllState {
  switch (action.type) {
    case 'start':
      return {
        items: action.targets.map((t) => ({ ...t, status: 'queued' as const, error: null }))
      }
    case 'running':
      return setItem(state, action.key, { status: 'running' })
    case 'done':
      return setItem(state, action.key, { status: 'done', error: null })
    case 'failed':
      return setItem(state, action.key, { status: 'failed', error: action.error })
    case 'close':
      return emptyFetchAll()
  }
}

export interface FetchTotals {
  total: number
  done: number
  failed: number
  /** Nothing is queued or running any more. */
  finished: boolean
}

export function fetchTotals(state: FetchAllState): FetchTotals {
  const done = state.items.filter((i) => i.status === 'done').length
  const failed = state.items.filter((i) => i.status === 'failed').length
  return {
    total: state.items.length,
    done,
    failed,
    finished: state.items.length > 0 && done + failed === state.items.length
  }
}

export function fetchTotalsText({ total, done, failed, finished }: FetchTotals): string {
  if (!finished) return `${done + failed} of ${total} done`
  if (failed === 0) return `All ${total} fetched`
  return `${done} fetched, ${failed} failed`
}
