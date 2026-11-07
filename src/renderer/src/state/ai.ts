import { useSyncExternalStore } from 'react'
import { readStored, writeStored } from './storage'

const KEY = 'gitdeck.ai.enabled'
const listeners = new Set<() => void>()
let enabled = readStored(KEY) === 'true'

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** AI commit messages are off until the user turns them on in Settings. */
export function setAiEnabled(next: boolean): void {
  enabled = next
  writeStored(KEY, next ? 'true' : null)
  for (const listener of listeners) listener()
}

export function useAiEnabled(): boolean {
  return useSyncExternalStore(subscribe, () => enabled)
}
