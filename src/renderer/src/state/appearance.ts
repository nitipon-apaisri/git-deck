import { useCallback, useState } from 'react'
import { readAccent, writeAccent, type Accent } from '../lib/accent'
import { readFont, writeFont, type FontId } from '../lib/font'
import { browserStorage } from './storage'

function applyAccent(accent: Accent): void {
  document.documentElement.dataset['accent'] = accent
}

function applyFont(font: FontId): void {
  document.documentElement.dataset['font'] = font
}

/** Call once before the first render, so the first paint already has the right look. */
export function initAppearance(): void {
  applyAccent(readAccent(browserStorage()))
  applyFont(readFont(browserStorage()))
}

export function useAccent(): { accent: Accent; setAccent: (next: Accent) => void } {
  const [accent, setState] = useState<Accent>(() => readAccent(browserStorage()))
  const setAccent = useCallback((next: Accent) => {
    setState(next)
    writeAccent(browserStorage(), next)
    applyAccent(next)
  }, [])
  return { accent, setAccent }
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
