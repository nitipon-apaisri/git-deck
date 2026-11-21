import type { AccountType } from '../shared/types'

export interface GitAuthInput {
  type: AccountType
  /** Origin of the remote, e.g. `https://gitlab.example.com`. */
  baseUrl: string
  token: string
  allowInsecureTls: boolean
}

/**
 * Env that gives git an Authorization header for one origin only. Using env keeps
 * the token out of argv and out of `.git/config`.
 */
export function gitAuthEnv(input: GitAuthInput): Record<string, string> {
  const origin = new URL(input.baseUrl).origin
  const user = input.type === 'github' ? 'x-access-token' : 'oauth2'
  const basic = Buffer.from(`${user}:${input.token}`).toString('base64')
  const env: Record<string, string> = {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `http.${origin}/.extraHeader`,
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${basic}`
  }
  // Scoped to this origin, so a redirect or submodule on another host is still verified.
  if (input.allowInsecureTls) {
    env['GIT_CONFIG_COUNT'] = '2'
    env['GIT_CONFIG_KEY_1'] = `http.${origin}/.sslVerify`
    env['GIT_CONFIG_VALUE_1'] = 'false'
  }
  return env
}
