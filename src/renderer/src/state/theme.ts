import { useCallback, useEffect, useState } from 'react'
import { readThemeSetting, resolveTheme, writeThemeSetting, type ThemeSetting } from '../lib/theme'
import { browserStorage } from './storage'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function applyTheme(setting: ThemeSetting): void {
  const dark = window.matchMedia(DARK_QUERY).matches
  document.documentElement.dataset['theme'] = resolveTheme(setting, dark)
}

/** Call once before the first render, so the first paint already has the right theme. */
export function initTheme(): void {
  applyTheme(readThemeSetting(browserStorage()))
}

export function useTheme(): { setting: ThemeSetting; setSetting: (next: ThemeSetting) => void } {
  const [setting, setSettingState] = useState<ThemeSetting>(() =>
    readThemeSetting(browserStorage())
  )

  const setSetting = useCallback((next: ThemeSetting) => {
    setSettingState(next)
    writeThemeSetting(browserStorage(), next)
    applyTheme(next)
  }, [])

  // "System" follows the OS while the app is open.
  useEffect(() => {
    if (setting !== 'system') return
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (): void => applyTheme('system')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [setting])

  return { setting, setSetting }
}
