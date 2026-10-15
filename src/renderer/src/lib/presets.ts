import type { ProviderType } from '@shared/types'

export interface Preset {
  id: string
  label: string
  type: ProviderType
  baseUrl: string
  /** .com presets have a fixed base URL */
  fixedUrl: boolean
}

export const PRESETS: Preset[] = [
  { id: 'github', label: 'GitHub.com', type: 'github', baseUrl: 'https://github.com', fixedUrl: true },
  { id: 'gitlab', label: 'GitLab.com', type: 'gitlab', baseUrl: 'https://gitlab.com', fixedUrl: true },
  { id: 'gitlab-self', label: 'GitLab self-hosted', type: 'gitlab', baseUrl: '', fixedUrl: false },
  { id: 'ghe', label: 'GitHub Enterprise', type: 'github', baseUrl: '', fixedUrl: false }
]

/** Page where the user can create a token with the right scopes pre-filled. */
export function tokenPageUrl(type: ProviderType, baseUrl: string): string | null {
  let origin: string
  try {
    origin = new URL(/^[a-z]+:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`).origin
  } catch {
    return null
  }
  return type === 'github'
    ? `${origin}/settings/tokens/new?scopes=repo&description=GitDeck`
    : `${origin}/-/user_settings/personal_access_tokens?name=GitDeck&scopes=read_api,read_repository`
}
