import { useCallback, useEffect, useReducer } from 'react'
import {
  SPLIT_KEY,
  defaultSplit,
  parseSplit,
  serializeSplit,
  splitReducer,
  type Orientation,
  type PaneId,
  type SplitState,
  type TabName
} from '../lib/splitState'
import { readStored, writeStored } from './storage'

/** Before Split View the selected repository was stored on its own. */
const LEGACY_SELECTION_KEY = 'gitdeck.selection'

function loadSplit(): SplitState {
  const raw = readStored(SPLIT_KEY)
  if (raw !== null) return parseSplit(raw)
  const legacy = readStored(LEGACY_SELECTION_KEY)
  if (!legacy) return defaultSplit()
  const state = defaultSplit()
  state.panes[0] = { ...state.panes[0], repoKey: legacy }
  return state
}

export interface Split {
  state: SplitState
  select: (repoKey: string) => void
  openInSplit: (repoKey: string) => void
  setActive: (pane: PaneId) => void
  setTab: (pane: PaneId, tab: TabName) => void
  close: (pane: PaneId) => void
  swap: () => void
  setOrientation: (orientation: Orientation) => void
  setRatio: (ratio: number) => void
  pruneRepos: (validKeys: ReadonlySet<string>) => void
  toggle: () => void
  /** Empties both panes and turns Split View off. */
  clear: () => void
}

/**
 * The one place that knows what each pane shows. The sidebar and the toolbar only call
 * this hook. The state is saved to localStorage after every change.
 */
export function useSplit(): Split {
  const [state, dispatch] = useReducer(splitReducer, undefined, loadSplit)

  useEffect(() => {
    writeStored(SPLIT_KEY, serializeSplit(state))
  }, [state])

  return {
    state,
    select: useCallback((repoKey) => dispatch({ type: 'select', repoKey }), []),
    openInSplit: useCallback((repoKey) => dispatch({ type: 'openInSplit', repoKey }), []),
    setActive: useCallback((pane) => dispatch({ type: 'setActive', pane }), []),
    setTab: useCallback((pane, tab) => dispatch({ type: 'setTab', pane, tab }), []),
    close: useCallback((pane) => dispatch({ type: 'close', pane }), []),
    swap: useCallback(() => dispatch({ type: 'swap' }), []),
    setOrientation: useCallback(
      (orientation) => dispatch({ type: 'setOrientation', orientation }),
      []
    ),
    setRatio: useCallback((ratio) => dispatch({ type: 'setRatio', ratio }), []),
    pruneRepos: useCallback((validKeys) => dispatch({ type: 'pruneRepos', validKeys }), []),
    toggle: useCallback(() => dispatch({ type: 'toggle' }), []),
    clear: useCallback(() => dispatch({ type: 'clear' }), [])
  }
}
