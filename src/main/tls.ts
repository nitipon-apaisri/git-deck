import type { Session } from 'electron'

// Result codes for Session.setCertificateVerifyProc: 0 accepts, -3 defers to Chromium.
const ACCEPT = 0
const DEFAULT = -3

const insecureHosts = new Set<string>()

const normalise = (host: string): string => host.trim().toLowerCase()

export function setInsecureHosts(hosts: Iterable<string>): void {
  insecureHosts.clear()
  for (const h of hosts) insecureHosts.add(normalise(h))
}

export function verifyResultFor(hostname: string): number {
  return insecureHosts.has(normalise(hostname)) ? ACCEPT : DEFAULT
}

/** Allow a host while testing an unsaved account; call the returned function to undo. */
export function allowHostTemporarily(host: string): () => void {
  const h = normalise(host)
  const already = insecureHosts.has(h)
  insecureHosts.add(h)
  return () => {
    if (!already) insecureHosts.delete(h)
  }
}

export function installCertVerifyProc(session: Session): void {
  session.setCertificateVerifyProc((request, callback) =>
    callback(verifyResultFor(request.hostname))
  )
}
