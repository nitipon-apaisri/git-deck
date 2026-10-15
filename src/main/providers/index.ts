import type { Account, ProviderType } from '../../shared/types'
import { GitHubProvider } from './github'
import { GitLabProvider } from './gitlab'
import { DEFAULT_BASE_URL, type GitProvider } from './types'

export type { GitProvider, ProviderUser } from './types'

/** Default per type, `https://` added when missing, http/https only, no trailing slash. */
export function normalizeBaseUrl(type: ProviderType, input: string): string {
  let raw = input.trim()
  if (!raw) return DEFAULT_BASE_URL[type]
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Invalid server URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Server URL must use http or https')
  if (url.username || url.password) throw new Error('Server URL must not contain credentials')
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
}

export function createProvider(account: Pick<Account, 'id' | 'type' | 'baseUrl'>, token: string): GitProvider {
  const baseUrl = normalizeBaseUrl(account.type, account.baseUrl)
  return account.type === 'github'
    ? new GitHubProvider(account.id, baseUrl, token)
    : new GitLabProvider(account.id, baseUrl, token)
}
