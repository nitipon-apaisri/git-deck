import type { KeyValueStore } from '../lib/theme'

/** `localStorage`, or `null` when the browser blocks it. Every caller copes with `null`. */
export function browserStorage(): KeyValueStore | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readStored(key: string): string | null {
  try {
    return browserStorage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string | null): void {
  try {
    const store = window.localStorage
    if (value === null) store.removeItem(key)
    else store.setItem(key, value)
  } catch {
    // Not persisted. The app works the same for this session.
  }
}
