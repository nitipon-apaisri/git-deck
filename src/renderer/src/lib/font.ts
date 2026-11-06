// UI font choice. Pure: storage is passed in, so tests need no DOM.
import type { KeyValueStore } from './theme'

export const FONT_KEY = 'gitdeck.font'

export interface FontOption {
  id: string
  label: string
  /** The CSS family list, shown in the picker. `appearance.css` holds the same lists. */
  family: string
}

export const FONTS = [
  { id: 'inter', label: 'Inter', family: "'Inter', system-ui, sans-serif" },
  { id: 'roboto', label: 'Roboto', family: "'Roboto', system-ui, sans-serif" },
  { id: 'open-sans', label: 'Open Sans', family: "'Open Sans', system-ui, sans-serif" },
  {
    id: 'system',
    label: 'System',
    family: "system-ui, -apple-system, 'Segoe UI', sans-serif"
  }
] as const satisfies readonly FontOption[]

export type FontId = (typeof FONTS)[number]['id']
export const DEFAULT_FONT: FontId = 'inter'

export function parseFont(value: string | null | undefined): FontId {
  const found = FONTS.find((f) => f.id === value)
  return found ? found.id : DEFAULT_FONT
}

export function readFont(store: KeyValueStore | null): FontId {
  try {
    return parseFont(store?.getItem(FONT_KEY))
  } catch {
    return DEFAULT_FONT
  }
}

export function writeFont(store: KeyValueStore | null, font: FontId): void {
  try {
    store?.setItem(FONT_KEY, font)
  } catch {
    // Not persisted; the choice still applies for this session.
  }
}
