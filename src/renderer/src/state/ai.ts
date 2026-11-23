import { useSyncExternalStore } from 'react'
import { isAiProvider, type AiConfig, type AiProviderId } from '@shared/ai'
import { readStored, writeStored } from './storage'

const KEY = 'gitdeck.ai.enabled'
const SETTINGS_KEY = 'gitdeck.ai.settings'
const listeners = new Set<() => void>()
let enabled = readStored(KEY) === 'true'

/** Non-secret choices. The API key lives in main (safeStorage), never here. */
export interface AiSettings {
  provider: AiProviderId
  /** Per provider, so switching back keeps what was typed. */
  models: Partial<Record<AiProviderId, string>>
  baseUrl: string
}

function readSettings(): AiSettings {
  const fallback: AiSettings = { provider: 'claude', models: {}, baseUrl: '' }
  try {
    const raw = JSON.parse(readStored(SETTINGS_KEY) ?? '{}') as Partial<AiSettings>
    return {
      provider: isAiProvider(raw.provider) ? raw.provider : fallback.provider,
      models: typeof raw.models === 'object' && raw.models !== null ? raw.models : {},
      baseUrl: typeof raw.baseUrl === 'string' ? raw.baseUrl : ''
    }
  } catch {
    return fallback
  }
}

let settings = readSettings()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify(): void {
  for (const listener of listeners) listener()
}

/** AI commit messages are off until the user turns them on in Settings. */
export function setAiEnabled(next: boolean): void {
  enabled = next
  writeStored(KEY, next ? 'true' : null)
  notify()
}

export function useAiEnabled(): boolean {
  return useSyncExternalStore(subscribe, () => enabled)
}

export function setAiSettings(patch: Partial<AiSettings>): void {
  settings = { ...settings, ...patch }
  writeStored(SETTINGS_KEY, JSON.stringify(settings))
  notify()
}

export function useAiSettings(): AiSettings {
  return useSyncExternalStore(subscribe, () => settings)
}

/** What each call sends to main. */
export function aiConfigOf(s: AiSettings): AiConfig {
  return { provider: s.provider, model: s.models[s.provider] ?? '', baseUrl: s.baseUrl }
}
