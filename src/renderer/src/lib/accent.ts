// Accent colour presets. Pure: storage is passed in, so tests need no DOM.
import type { KeyValueStore } from './theme'

export const ACCENT_KEY = 'gitdeck.accent'

export interface AccentPreset {
  id: string
  label: string
}

/** The first one is the default and has no overrides (`accents.css` only has the others). */
export const ACCENTS = [
  { id: 'blue', label: 'Blue' },
  { id: 'violet', label: 'Violet' },
  { id: 'green', label: 'Green' },
  { id: 'orange', label: 'Orange' },
  { id: 'rose', label: 'Rose' }
] as const satisfies readonly AccentPreset[]

export type Accent = (typeof ACCENTS)[number]['id']
export const DEFAULT_ACCENT: Accent = 'blue'

export function parseAccent(value: string | null | undefined): Accent {
  const found = ACCENTS.find((a) => a.id === value)
  return found ? found.id : DEFAULT_ACCENT
}

/** Storage can throw (blocked site data), so a failure means the default. */
export function readAccent(store: KeyValueStore | null): Accent {
  try {
    return parseAccent(store?.getItem(ACCENT_KEY))
  } catch {
    return DEFAULT_ACCENT
  }
}

export function writeAccent(store: KeyValueStore | null, accent: Accent): void {
  try {
    store?.setItem(ACCENT_KEY, accent)
  } catch {
    // Not persisted; the choice still applies for this session.
  }
}
