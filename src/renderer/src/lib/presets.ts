// Account presets and token links. Pure, so the dialog logic is testable.
import { normalizeBaseUrl } from '../../../shared/baseUrl'
import type { AccountType } from '../../../shared/types'

export type PresetId = 'github' | 'gitlab' | 'gitlab-self' | 'github-enterprise'
export type HostKind = 'github' | 'gitlab' | 'selfhosted'

export interface Preset {
  id: PresetId
  type: AccountType
  title: string
  sub: string
  /** Two-letter host tile label. */
  tile: string
  host: HostKind
  /** `null` means the user types the base URL. */
  fixedBaseUrl: string | null
  defaultLabel: string
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'github',
    type: 'github',
    title: 'GitHub.com',
    sub: 'Personal or org repos',
    tile: 'GH',
    host: 'github',
    fixedBaseUrl: 'https://github.com',
    defaultLabel: 'GitHub'
  },
  {
    id: 'gitlab',
    type: 'gitlab',
    title: 'GitLab.com',
    sub: 'Hosted by GitLab',
    tile: 'GL',
    host: 'gitlab',
    fixedBaseUrl: 'https://gitlab.com',
    defaultLabel: 'GitLab'
  },
  {
    id: 'gitlab-self',
    type: 'gitlab',
    title: 'GitLab self-hosted',
    sub: 'Your own base URL',
    tile: 'SH',
    host: 'selfhosted',
    fixedBaseUrl: null,
    defaultLabel: ''
  },
  {
    id: 'github-enterprise',
    type: 'github',
    title: 'GitHub Enterprise',
    sub: 'Your own base URL',
    tile: 'GE',
    host: 'selfhosted',
    fixedBaseUrl: null,
    defaultLabel: ''
  }
]

export function presetOf(id: PresetId): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]
}

/** Tile text and colour class for an existing account. */
export function hostTileOf(type: AccountType, baseUrl: string): { tile: string; host: HostKind } {
  const host = hostnameOf(baseUrl)
  if (type === 'github') {
    return host === 'github.com'
      ? { tile: 'GH', host: 'github' }
      : { tile: 'GE', host: 'selfhosted' }
  }
  return host === 'gitlab.com' ? { tile: 'GL', host: 'gitlab' } : { tile: 'SH', host: 'selfhosted' }
}

export function hostnameOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/** The normalised base URL, or `null` while the input is not a usable URL yet. */
export function tryNormalize(type: AccountType, input: string): string | null {
  if (!input.trim()) return null
  try {
    return normalizeBaseUrl(type, input)
  } catch {
    return null
  }
}

/** Scopes each host needs: shown under the token field and pre-filled in the link. */
export const TOKEN_SCOPES: Record<AccountType, readonly string[]> = {
  github: ['repo', 'read:org'],
  gitlab: ['read_api', 'read_repository']
}

/** The host's "new personal access token" page with the scopes filled in. */
export function tokenUrl(type: AccountType, baseUrl: string): string {
  const scopes = TOKEN_SCOPES[type]
  if (type === 'github') {
    const params = new URLSearchParams({ scopes: scopes.join(','), description: 'GitDeck' })
    return `${baseUrl}/settings/tokens/new?${params}`
  }
  const params = new URLSearchParams({ name: 'GitDeck', scopes: scopes.join(',') })
  return `${baseUrl}/-/user_settings/personal_access_tokens?${params}`
}
