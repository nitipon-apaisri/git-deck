import type { Session } from 'electron'

const insecureHosts = new Set<string>()

const norm = (host: string): string => host.trim().toLowerCase()

export function setInsecureHosts(hosts: Iterable<string>): void {
  insecureHosts.clear()
  for (const h of hosts) insecureHosts.add(norm(h))
}

export function isInsecureHost(host: string): boolean {
  return insecureHosts.has(norm(host))
}

/** Allow a host only while `fn` runs, e.g. when testing an unsaved account. */
export async function withTemporaryInsecureHost<T>(host: string, allow: boolean, fn: () => Promise<T>): Promise<T> {
  const h = norm(host)
  if (!allow || insecureHosts.has(h)) return fn()
  insecureHosts.add(h)
  try {
    return await fn()
  } finally {
    insecureHosts.delete(h)
  }
}

/** 0 = accept, -3 = fall back to Chromium's default verification. */
export function installCertificateVerifier(ses: Session): void {
  ses.setCertificateVerifyProc((request, callback) => {
    callback(isInsecureHost(request.hostname) ? 0 : -3)
  })
}
