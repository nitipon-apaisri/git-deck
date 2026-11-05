// Pure: no DOM, so it runs under tsx tests.

/** Electron prefixes rejected invoke calls with this; users should not see it. */
const IPC_PREFIX = /^Error invoking remote method '[^']*':\s*/
const ERROR_PREFIX = /^(?:[A-Za-z]*Error:\s*)+/

// Network and HTTP failures, said plainly with what to do. The code stays for support.
const FRIENDLY: readonly [RegExp, (match: RegExpExecArray) => string][] = [
  [
    /net::ERR_CONNECTION_REFUSED/,
    () => 'The server refused the connection. Check the base URL and port.'
  ],
  [
    /net::ERR_NAME_NOT_RESOLVED/,
    () => 'The server address could not be found. Check the base URL.'
  ],
  [
    /net::ERR_INTERNET_DISCONNECTED|net::ERR_NETWORK_CHANGED/,
    () => 'There is no internet connection.'
  ],
  [
    /net::ERR_CERT_\w+|net::ERR_SSL_\w+/,
    () =>
      'The server certificate is not trusted. If you trust this host, allow its self-signed certificate.'
  ],
  [/net::ERR_CONNECTION_TIMED_OUT|^Request timed out/, () => 'The server did not answer in time.'],
  [
    /Request failed: 401\b/,
    () => 'The host rejected the token (401). Check the token and its scopes.'
  ],
  [/Request failed: 403\b/, () => 'The token is not allowed to do this (403). Check its scopes.'],
  [/Request failed: 404\b/, () => 'The host could not find this (404). Check the base URL.'],
  [
    /Request failed: (429|5\d\d)\b/,
    (m) => `The host is unavailable or limiting requests (${m[1]}). Try again later.`
  ],
  [/net::(ERR_\w+)/, (m) => `Could not reach the server (${m[1]}).`]
]

export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const cleaned = raw.replace(IPC_PREFIX, '').replace(ERROR_PREFIX, '').trim()
  if (!cleaned) return 'Something went wrong'
  for (const [pattern, say] of FRIENDLY) {
    const match = pattern.exec(cleaned)
    if (match) return say(match)
  }
  return cleaned
}
