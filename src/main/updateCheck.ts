// No electron import. Asks GitHub for the latest release of this public repo; nothing is sent
// but the request itself (no token, no app data).
import type { UpdateCheck } from '../shared/types'
import { getJson, HttpError } from './http'

export const RELEASES_API = 'https://api.github.com/repos/nitipon-apaisri/git-deck/releases/latest'

function parts(version: string): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** True when `latest` is a higher major.minor.patch than `current`. Pre-release tags are ignored. */
export function isNewer(current: string, latest: string): boolean {
  const a = parts(current)
  const b = parts(latest)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return b[i] > a[i]
  return false
}

/** The version and release page from a GitHub release payload, or null when it is not one. */
export function parseRelease(payload: unknown): { version: string; url: string } | null {
  if (typeof payload !== 'object' || payload === null) return null
  const { tag_name: tag, html_url: url } = payload as Record<string, unknown>
  // A -rc tag is a pre-release: never offer it, even if the API returned one.
  if (typeof tag !== 'string' || typeof url !== 'string' || !parts(tag) || tag.includes('-'))
    return null
  if (!url.startsWith('https://github.com/')) return null
  return { version: tag.replace(/^v/, ''), url }
}

export async function checkForUpdate(current: string): Promise<UpdateCheck> {
  try {
    const release = parseRelease(
      await getJson(RELEASES_API, { Accept: 'application/vnd.github+json' })
    )
    return { current, latest: release && isNewer(current, release.version) ? release : null }
  } catch (err) {
    // 404: the repo has no release yet, so there is nothing newer.
    if (err instanceof HttpError && err.status === 404) return { current, latest: null }
    throw err
  }
}
