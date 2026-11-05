// No electron import: main/index.ts swaps in net.fetch via configureFetch.
export type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>

let fetchImpl: FetchImpl = (input, init) => fetch(input, init)

export function configureFetch(impl: FetchImpl): void {
  fetchImpl = impl
}

export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

const TIMEOUT_MS = 30_000
const MAX_PAGES = 100

type Headers_ = Record<string, string>

// Never put request headers in messages: they carry the token.
async function request(url: string, headers: Headers_, method = 'GET'): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetchImpl(url, { method, headers, signal: controller.signal })
    if (!res.ok) {
      throw new HttpError(res.status, `Request failed: ${res.status} ${res.statusText}`.trim())
    }
    return res
  } catch (err) {
    if (err instanceof HttpError) throw err
    if (controller.signal.aborted) throw new HttpError(0, 'Request timed out')
    throw new HttpError(0, err instanceof Error ? err.message : 'Network error')
  } finally {
    clearTimeout(timer)
  }
}

async function readJson<T>(res: Response): Promise<T | null> {
  if (res.status === 204) return null
  const text = await res.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as T
  } catch {
    throw new HttpError(res.status, 'Response was not valid JSON')
  }
}

export async function getJson<T>(url: string, headers: Headers_ = {}): Promise<T | null> {
  return readJson<T>(await request(url, headers))
}

export interface LinkRels {
  next: string | null
  last: string | null
}

export function parseLink(header: string | null | undefined): LinkRels {
  const out: LinkRels = { next: null, last: null }
  if (!header) return out
  for (const part of header.split(',')) {
    const m = /<([^>]*)>\s*;\s*rel="?([^";]+)"?/.exec(part.trim())
    if (!m) continue
    if (m[2] === 'next') out.next = m[1]
    else if (m[2] === 'last') out.last = m[1]
  }
  return out
}

export async function paginate<T>(url: string, headers: Headers_ = {}): Promise<T[]> {
  const items: T[] = []
  let next: string | null = url
  for (let page = 0; next && page < MAX_PAGES; page++) {
    const res = await request(next, headers)
    const body = await readJson<T[]>(res)
    if (Array.isArray(body)) items.push(...body)
    const link = parseLink(res.headers.get('link')).next
    // Resolve against the current page: relative links and path-prefixed installs.
    next = link ? new URL(link, next).toString() : null
  }
  return items
}

export interface Page<T> {
  items: T[]
  /** From the `x-total` header when the server sends it, else `null`. */
  total: number | null
}

/** One request: the array body plus the `x-total` header (GitLab). */
export async function getPage<T>(url: string, headers: Headers_ = {}): Promise<Page<T>> {
  const res = await request(url, headers)
  const body = await readJson<T[]>(res)
  const total = res.headers.get('x-total')
  return {
    items: Array.isArray(body) ? body : [],
    total: total !== null && /^\d+$/.test(total) ? Number(total) : null
  }
}

function withPerPageOne(url: string): string {
  const u = new URL(url)
  u.searchParams.set('per_page', '1')
  return u.toString()
}

/** Total count via a one-item request; `null` when it cannot be determined. */
export async function countItems(url: string, headers: Headers_ = {}): Promise<number | null> {
  const res = await request(withPerPageOne(url), headers)
  const total = res.headers.get('x-total')
  if (total !== null && /^\d+$/.test(total)) return Number(total)
  const { next, last } = parseLink(res.headers.get('link'))
  if (last) {
    const page = new URL(last, url).searchParams.get('page')
    if (page && /^\d+$/.test(page)) return Number(page)
  }
  if (next) return null
  const body = await readJson<unknown>(res)
  return Array.isArray(body) ? body.length : null
}
