import type { PaneCommands } from '../lib/paletteItems'

// The pane that has focus registers what the palette may run on it. Only one pane is active
// at a time, so one slot is enough. It is read when the palette opens, so it is no state.
let current: PaneCommands | null = null

/** Returns the cleanup. A pane that lost focus does not clear a newer pane's entry. */
export function registerPane(commands: PaneCommands): () => void {
  current = commands
  return () => {
    if (current === commands) current = null
  }
}

export const activePane = (): PaneCommands | null => current
