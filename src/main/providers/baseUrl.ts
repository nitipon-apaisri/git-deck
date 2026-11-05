import type { AccountType } from '../../shared/types'

const DEFAULTS: Record<AccountType, string> = {
  github: 'https://github.com',
  gitlab: 'https://gitlab.com'
}

/**
 * Default per type, `https://` added when missing, http/https only,
 * query/hash/trailing slash stripped, path prefix kept.
 */
export function normalizeBaseUrl(type: AccountType, input: string): string {
  let raw = input.trim()
  if (!raw) return DEFAULTS[type]
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Invalid server URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Server URL must start with http:// or https://')
  }
  if (url.username || url.password) throw new Error('Server URL must not contain credentials')
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}
