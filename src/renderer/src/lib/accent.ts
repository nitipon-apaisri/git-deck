// Accent colour presets. Pure: storage is passed in, so tests need no DOM.
import type { KeyValueStore, ResolvedTheme } from './theme'

/** The key from before accents were per theme: it still seeds both themes until one is chosen. */
export const ACCENT_KEY = 'gitdeck.accent'
export const accentKey = (theme: ResolvedTheme): string => `${ACCENT_KEY}.${theme}`

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
/** With no saved choice the theme decides: orange in warm, blue in dark and light. */
export function defaultAccent(theme: string | undefined): Accent {
  return theme === 'warm' ? 'orange' : 'blue'
}

/** The saved accent, or null when the person never chose one. */
export function parseAccent(value: string | null | undefined): Accent | null {
  return ACCENTS.find((a) => a.id === value)?.id ?? null
}

/** Storage can throw (blocked site data), so a failure means no choice. */
export function readAccent(store: KeyValueStore | null, theme: ResolvedTheme): Accent | null {
  try {
    return parseAccent(store?.getItem(accentKey(theme))) ?? parseAccent(store?.getItem(ACCENT_KEY))
  } catch {
    return null
  }
}

export function writeAccent(
  store: KeyValueStore | null,
  theme: ResolvedTheme,
  accent: Accent
): void {
  try {
    store?.setItem(accentKey(theme), accent)
  } catch {
    // Not persisted; the choice still applies for this session.
  }
}
