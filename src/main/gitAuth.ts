import type { Account } from '../shared/types'

/**
 * Environment that gives git an Authorization header for one origin only.
 * Uses GIT_CONFIG_COUNT so the token never reaches argv or .git/config.
 */
export function buildGitAuthEnv(account: Account, token: string): Record<string, string> {
  const user = account.type === 'github' ? 'x-access-token' : 'oauth2'
  const basic = Buffer.from(`${user}:${token}`).toString('base64')
  const origin = new URL(account.baseUrl).origin
  const env: Record<string, string> = {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `http.${origin}/.extraHeader`,
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${basic}`
  }
  if (account.allowInsecureTls) env.GIT_SSL_NO_VERIFY = 'true'
  return env
}
