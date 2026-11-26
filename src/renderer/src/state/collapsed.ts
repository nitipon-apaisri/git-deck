import { readStored, writeStored } from './storage'

/** One key for every collapsible section (sidebar groups, Home sections). */
export const COLLAPSED_KEY = 'gitdeck.collapsed'

export function readCollapsed(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(readStored(COLLAPSED_KEY) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

/** Flips `key` in the stored set and returns it. Reads first, so another screen's keys survive. */
export function toggleCollapsed(key: string): Set<string> {
  const next = readCollapsed()
  if (next.has(key)) next.delete(key)
  else next.add(key)
  writeStored(COLLAPSED_KEY, JSON.stringify([...next]))
  return next
}
