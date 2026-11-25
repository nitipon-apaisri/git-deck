import { useCallback, useSyncExternalStore } from 'react'
import { HIDDEN_KEY, parseHidden, setHidden, type HiddenMap } from '../lib/hiddenRefs'
import { readStored, writeStored } from './storage'

// One store for every pane, keyed by repo path: two panes on one repo agree, two repos do not mix.
let map: HiddenMap = parseHidden(readStored(HIDDEN_KEY))
// Session only: "Show hidden" is not remembered across launches.
let revealed = new Set<string>()
const listeners = new Set<() => void>()
const NONE: string[] = []

function emit(): void {
  for (const l of listeners) l()
}
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export interface HiddenRefs {
  /** Every hidden ref of the repo, whether or not "Show hidden" is on. */
  all: readonly string[]
  /** What the graph leaves out: nothing while "Show hidden" is on. */
  active: readonly string[]
  showHidden: boolean
  setRef: (ref: string, hidden: boolean) => void
  setShowHidden: (on: boolean) => void
}

export function useHiddenRefs(path: string | null): HiddenRefs {
  const all = useSyncExternalStore(subscribe, () => (path ? (map[path] ?? NONE) : NONE))
  const showHidden = useSyncExternalStore(subscribe, () => path !== null && revealed.has(path))
  const setRef = useCallback(
    (ref: string, hide: boolean) => {
      if (!path) return
      map = setHidden(map, path, ref, hide)
      writeStored(HIDDEN_KEY, JSON.stringify(map))
      emit()
    },
    [path]
  )
  const setShowHidden = useCallback(
    (on: boolean) => {
      if (!path) return
      revealed = new Set(revealed)
      if (on) revealed.add(path)
      else revealed.delete(path)
      emit()
    },
    [path]
  )
  return { all, active: showHidden ? NONE : all, showHidden, setRef, setShowHidden }
}
