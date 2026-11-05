// Summaries of many repositories at once, for the project overview. A pure reducer.
import type { Cached, RepoSummary } from '../../../shared/types'
import type { LoadProgress } from './projectRows'

export interface SummaryStore {
  entries: Record<string, Cached<RepoSummary>>
  /** Plain message per key whose last fetch failed. An older summary stays in `entries`. */
  failed: Record<string, string>
  /** Keys queued or running in the current batch. */
  pending: string[]
  /** Size of the current batch. */
  total: number
}

export type SummaryAction =
  /** Read from the cache: never replaces a newer entry already held. */
  | { type: 'cached'; entries: Record<string, Cached<RepoSummary>> }
  /** A new batch starts. It replaces the previous one. An empty list ends it. */
  | { type: 'batch'; keys: string[] }
  | { type: 'fetched'; key: string; entry: Cached<RepoSummary> }
  | { type: 'failed'; key: string; error: string }

export const emptySummaries = (): SummaryStore => ({
  entries: {},
  failed: {},
  pending: [],
  total: 0
})

export function summaryReducer(state: SummaryStore, action: SummaryAction): SummaryStore {
  switch (action.type) {
    case 'cached': {
      let entries = state.entries
      for (const [key, entry] of Object.entries(action.entries)) {
        const have = entries[key]
        if (have && have.fetchedAt >= entry.fetchedAt) continue
        if (entries === state.entries) entries = { ...entries }
        entries[key] = entry
      }
      return entries === state.entries ? state : { ...state, entries }
    }
    case 'batch':
      return { ...state, pending: [...new Set(action.keys)], total: new Set(action.keys).size }
    case 'fetched': {
      const { [action.key]: _cleared, ...failed } = state.failed
      void _cleared
      return {
        ...state,
        entries: { ...state.entries, [action.key]: action.entry },
        failed,
        pending: state.pending.filter((k) => k !== action.key)
      }
    }
    case 'failed':
      return {
        ...state,
        failed: { ...state.failed, [action.key]: action.error },
        pending: state.pending.filter((k) => k !== action.key)
      }
  }
}

/** `null` when no batch is running. */
export function progressOf(state: SummaryStore): LoadProgress | null {
  if (state.pending.length === 0 || state.total === 0) return null
  return { done: state.total - state.pending.length, total: state.total }
}
