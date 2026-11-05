import type { Account } from '../../shared/types'
import { normalizeBaseUrl } from '../../shared/baseUrl'
import { GitHubProvider } from './github'
import { GitLabProvider } from './gitlab'
import type { GitProvider } from './types'

export { normalizeBaseUrl } from '../../shared/baseUrl'
export type { GitProvider, VerifiedUser } from './types'

/** The account's base URL is normalised here, so callers may pass raw user input. */
export function createProvider(
  account: Pick<Account, 'id' | 'type' | 'baseUrl'>,
  token: string
): GitProvider {
  const baseUrl = normalizeBaseUrl(account.type, account.baseUrl)
  return account.type === 'github'
    ? new GitHubProvider(account.id, baseUrl, token)
    : new GitLabProvider(account.id, baseUrl, token)
}
