export type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>

let fetchImpl: FetchImpl = (input, init) => fetch(input, init)

/** Swap the fetch implementation (main/index.ts uses Electron's net.fetch). */
export function configureFetch(impl: FetchImpl): void {
  fetchImpl = impl
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

const TIMEOUT_MS = 30_000
const MAX_PAGES = 100

async function request(url: string, headers: Record<string, string>): Promise<Response> {
  let res: Response
  try {
    res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (e) {
    const err = e as Error
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new HttpError(0, 'Request timed out')
    }
    throw new HttpError(0, `Network error: ${err.message}`)
  }
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { message?: unknown; error?: unknown }
      const m = body.message ?? body.error
      if (typeof m === 'string') detail = `: ${m}`
    } catch {
      /* body is not JSON */
    }
    throw new HttpError(res.status, `HTTP ${res.status}${detail}`)
  }
  return res
}

async function readJson<T>(res: Response): Promise<T> {
  if (res.status === 204) return null as T
  const text = await res.text()
  if (!text.trim()) return null as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new HttpError(res.status, 'Invalid JSON in response')
  }
}

export async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  return readJson<T>(await request(url, headers))
}

/** Like getJson, but also returns the response headers (x-total, link, ...). */
export async function getJsonWithHeaders<T>(
  url: string,
  headers: Record<string, string> = {}
): Promise<{ data: T; headers: Headers }> {
  const res = await request(url, headers)
  return { data: await readJson<T>(res), headers: res.headers }
}

export function parseLink(header: string | null | undefined): { next?: string; last?: string } {
  const out: { next?: string; last?: string } = {}
  if (!header) return out
  for (const part of header.split(/,\s*(?=<)/)) {
    const m = /^\s*<([^>]*)>(.*)$/.exec(part)
    if (!m) continue
    const rel = /rel="?([^";]+)"?/.exec(m[2])
    if (rel?.[1] === 'next') out.next = m[1]
    else if (rel?.[1] === 'last') out.last = m[1]
  }
  return out
}

/** Follow rel="next" links, concatenating array pages (max 100 pages). */
export async function paginate<T>(url: string, headers: Record<string, string> = {}): Promise<T[]> {
  const items: T[] = []
  let next: string | undefined = url
  for (let page = 0; next && page < MAX_PAGES; page++) {
    const res: Response = await request(next, headers)
    const body = await readJson<T[]>(res)
    if (Array.isArray(body)) items.push(...body)
    next = parseLink(res.headers.get('link')).next
  }
  return items
}

/** Count items cheaply by requesting one per page. Returns null when unknown. */
export async function countItems(url: string, headers: Record<string, string> = {}): Promise<number | null> {
  const u = new URL(url)
  u.searchParams.set('per_page', '1')
  const res = await request(u.toString(), headers)
  const total = Number.parseInt(res.headers.get('x-total') ?? '', 10)
  if (Number.isFinite(total)) return total
  const link = parseLink(res.headers.get('link'))
  if (link.last) {
    const page = Number.parseInt(new URL(link.last, u).searchParams.get('page') ?? '', 10)
    if (Number.isFinite(page)) return page
  }
  if (link.next) return null
  const body = await readJson<unknown>(res)
  return Array.isArray(body) ? body.length : 0
}
