// Accent colour presets. Pure: storage is passed in, so tests need no DOM.
import type { KeyValueStore } from './theme'

export const ACCENT_KEY = 'gitdeck.accent'

export interface AccentPreset {
  id: string
  label: string
}

/** Each theme's default accent lives in `tokens.css`; the rest are in `appearance.css`. */
export const ACCENTS = [
  { id: 'orange', label: 'Orange' },
  { id: 'blue', label: 'Blue' },
  { id: 'violet', label: 'Violet' },
  { id: 'green', label: 'Green' },
  { id: 'rose', label: 'Rose' }
] as const satisfies readonly AccentPreset[]

export type Accent = (typeof ACCENTS)[number]['id']
/** With no saved choice the theme decides: blue in dark, orange in light. */
export function defaultAccent(theme: string | undefined): Accent {
  return theme === 'dark' ? 'blue' : 'orange'
}

/** The saved accent, or null when the person never chose one. */
export function parseAccent(value: string | null | undefined): Accent | null {
  return ACCENTS.find((a) => a.id === value)?.id ?? null
}

/** Storage can throw (blocked site data), so a failure means no choice. */
export function readAccent(store: KeyValueStore | null): Accent | null {
  try {
    return parseAccent(store?.getItem(ACCENT_KEY))
  } catch {
    return null
  }
}

export function writeAccent(store: KeyValueStore | null, accent: Accent): void {
  try {
    store?.setItem(ACCENT_KEY, accent)
  } catch {
    // Not persisted; the choice still applies for this session.
  }
}
