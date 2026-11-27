import { useCallback, useEffect, useState } from 'react'
import { readAccent, writeAccent, type Accent } from '../lib/accent'
import { readFont, writeFont, type FontId } from '../lib/font'
import type { ResolvedTheme } from '../lib/theme'
import { browserStorage } from './storage'

/** No choice: drop the attribute, so the theme's own default shows. */
function applyAccent(accent: Accent | null): void {
  if (accent) document.documentElement.dataset['accent'] = accent
  else delete document.documentElement.dataset['accent']
}

function applyFont(font: FontId): void {
  document.documentElement.dataset['font'] = font
}

function currentTheme(): ResolvedTheme {
  const theme = document.documentElement.dataset['theme']
  return theme === 'dark' || theme === 'warm' ? theme : 'light'
}

/** Runs `fn` now and whenever the resolved theme changes (a pick, or the OS flipping). */
function onThemeChange(fn: () => void): () => void {
  fn()
  const watch = new MutationObserver(fn)
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => watch.disconnect()
}

/** Call once before the first render, so the first paint already has the right look. */
export function initAppearance(): void {
  onThemeChange(() => applyAccent(readAccent(browserStorage(), currentTheme())))
  applyFont(readFont(browserStorage()))
}

/** The accent of the theme in use: each theme keeps its own. */
export function useAccent(): {
  accent: Accent | null
  theme: ResolvedTheme
  setAccent: (next: Accent) => void
} {
  const [theme, setTheme] = useState(currentTheme)
  const [accent, setState] = useState<Accent | null>(() =>
    readAccent(browserStorage(), currentTheme())
  )
  useEffect(
    () =>
      onThemeChange(() => {
        const now = currentTheme()
        setTheme(now)
        setState(readAccent(browserStorage(), now))
      }),
    []
  )
  const setAccent = useCallback((next: Accent) => {
    const now = currentTheme()
    setState(next)
    writeAccent(browserStorage(), now, next)
    applyAccent(next)
  }, [])
  return { accent, theme, setAccent }
}

export function useFont(): { font: FontId; setFont: (next: FontId) => void } {
  const [font, setState] = useState<FontId>(() => readFont(browserStorage()))
  const setFont = useCallback((next: FontId) => {
    setState(next)
    writeFont(browserStorage(), next)
    applyFont(next)
  }, [])
  return { font, setFont }
}
