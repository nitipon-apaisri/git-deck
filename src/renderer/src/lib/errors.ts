// Pure: no DOM, so it runs under tsx tests.

/** Electron prefixes rejected invoke calls with this; users should not see it. */
const IPC_PREFIX = /^Error invoking remote method '[^']*':\s*/
const ERROR_PREFIX = /^(?:[A-Za-z]*Error:\s*)+/

export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const cleaned = raw.replace(IPC_PREFIX, '').replace(ERROR_PREFIX, '').trim()
  return cleaned || 'Something went wrong'
}
