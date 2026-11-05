// Pure theme logic. Storage and the media query are passed in, so tests need no DOM.
export type ThemeSetting = 'system' | 'dark' | 'light'
export type ResolvedTheme = 'dark' | 'light'

export const THEME_KEY = 'gitdeck.theme'
export const THEME_SETTINGS: readonly ThemeSetting[] = ['system', 'dark', 'light']

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function parseThemeSetting(value: string | null | undefined): ThemeSetting {
  return value === 'dark' || value === 'light' || value === 'system' ? value : 'system'
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
