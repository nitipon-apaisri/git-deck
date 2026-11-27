// Pure theme logic. Storage and the media query are passed in, so tests need no DOM.
export type ThemeSetting = 'system' | 'dark' | 'light' | 'warm'
/** What `data-theme` holds. "System" resolves to dark or light, never warm. */
export type ResolvedTheme = 'dark' | 'light' | 'warm'

export const THEME_KEY = 'gitdeck.theme'
export const THEME_SETTINGS: readonly ThemeSetting[] = ['system', 'light', 'dark', 'warm']

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function parseThemeSetting(value: string | null | undefined): ThemeSetting {
  return THEME_SETTINGS.find((t) => t === value) ?? 'system'
}

export function resolveTheme(setting: ThemeSetting, systemPrefersDark: boolean): ResolvedTheme {
  if (setting === 'system') return systemPrefersDark ? 'dark' : 'light'
  return setting
}

/** Storage can throw (blocked site data), so a failure means the default. */
export function readThemeSetting(store: KeyValueStore | null): ThemeSetting {
  try {
    return parseThemeSetting(store?.getItem(THEME_KEY))
  } catch {
    return 'system'
  }
}

export function writeThemeSetting(store: KeyValueStore | null, setting: ThemeSetting): void {
  try {
    store?.setItem(THEME_KEY, setting)
  } catch {
    // Not persisted; the choice still applies for this session.
  }
}
