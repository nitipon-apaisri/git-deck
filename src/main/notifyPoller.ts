// Polls PR/MR lists of repositories whose project asked for notifications. No electron
// import: the service injects the provider calls and the notifier, tests inject fakes.
import { diffChangeRequests } from '../shared/notify'
import type { ChangeRequest, CheckState, ChecksInfo, NotifyEvent, Project } from '../shared/types'
import { HttpError } from './http'

/** Above PLAN.md's 60 s floor: two list pages per repository per poll. */
export const POLL_MS = 120_000
export const MAX_BACKOFF_MS = 30 * 60_000

export interface Notice {
  repoKey: string
  projectId: string
  /** `stopped`: the host refused the token, so this repository is no longer polled. */
  kind: NotifyEvent | 'stopped'
  cr?: Pick<ChangeRequest, 'number' | 'title'>
}

export interface PollerDeps {
  projects(): Project[]
  list(repoKey: string): Promise<ChangeRequest[]>
  checks(repoKey: string, ref: string): Promise<ChecksInfo>
  notify(notice: Notice): void
  now?(): number
  /** Runs `fn` every `ms`; returns a stop function. */
  every?(fn: () => void, ms: number): () => void
}

interface RepoState {
  prev: ChangeRequest[] | null
  checks: Map<number, { ref: string; state: CheckState }>
  stopped: boolean
  delay: number
  nextAt: number
}

const realEvery = (fn: () => void, ms: number): (() => void) => {
  const id = setInterval(fn, ms)
  return () => clearInterval(id)
}

export function createPoller(deps: PollerDeps) {
  const now = deps.now ?? Date.now
  const every = deps.every ?? realEvery
  const state = new Map<string, RepoState>()
  let running: Promise<void> | null = null
  let stopTimer: (() => void) | null = null

  /** repoKey -> the events any of its projects watch, and the first such project. */
  function watched(): Map<string, { events: Set<NotifyEvent>; projectId: string }> {
    const out = new Map<string, { events: Set<NotifyEvent>; projectId: string }>()
    for (const p of deps.projects()) {
      if (!p.notify?.length) continue
      for (const key of p.repoKeys) {
        if (key.startsWith('local:')) continue
        const entry = out.get(key) ?? { events: new Set(), projectId: p.id }
        for (const e of p.notify) entry.events.add(e)
        out.set(key, entry)
      }
    }
    return out
  }

  async function pollRepo(
    key: string,
    s: RepoState,
    w: { events: Set<NotifyEvent>; projectId: string }
  ): Promise<void> {
    const send = (kind: Notice['kind'], cr?: ChangeRequest): void =>
      deps.notify({
        repoKey: key,
        projectId: w.projectId,
        kind,
        ...(cr ? { cr: { number: cr.number, title: cr.title } } : {})
      })
    try {
      const next = await deps.list(key)
      for (const e of diffChangeRequests(s.prev, next)) if (w.events.has(e.kind)) send(e.kind, e.cr)
      s.prev = next
      if (w.events.has('checksFailed')) {
        const open = next.filter((cr) => cr.state === 'open')
        for (const n of s.checks.keys()) if (!open.some((cr) => cr.number === n)) s.checks.delete(n)
        for (const cr of open) {
          const last = s.checks.get(cr.number)
          // Only a new head or a still-running pipeline is worth a request.
          if (last && last.ref === cr.checksRef && last.state !== 'pending') continue
          const { state: now_ } = await deps.checks(key, cr.checksRef)
          s.checks.set(cr.number, { ref: cr.checksRef, state: now_ })
          const fresh = last && (last.ref !== cr.checksRef || last.state !== 'failure')
          if (fresh && now_ === 'failure') send('checksFailed', cr)
        }
      }
      s.delay = POLL_MS
      s.nextAt = 0
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 0
      if (status === 401 || status === 403) {
        s.stopped = true
        send('stopped')
      } else if (status === 429) {
        s.delay = Math.min(s.delay * 2, MAX_BACKOFF_MS)
        s.nextAt = now() + s.delay
      }
      // Anything else (offline, timeout, 5xx): try again next tick.
    }
  }

  async function run(): Promise<void> {
    const w = watched()
    // A repository nobody watches any more starts from a fresh baseline if watched again.
    for (const key of state.keys()) if (!w.has(key)) state.delete(key)
    for (const [key, entry] of w) {
      let s = state.get(key)
      if (!s) {
        s = { prev: null, checks: new Map(), stopped: false, delay: POLL_MS, nextAt: 0 }
        state.set(key, s)
      }
      if (s.stopped || now() < s.nextAt) continue
      await pollRepo(key, s, entry)
    }
  }

  /** One pass over the watched repositories; a pass already running is joined, not doubled. */
  function tick(): Promise<void> {
    running ??= run().finally(() => {
      running = null
    })
    return running
  }

  return {
    tick,
    start(): void {
      stopTimer ??= every(() => void tick(), POLL_MS)
      void tick()
    },
    /** Settings or accounts changed: retry stopped repositories and poll now. */
    restart(): void {
      for (const s of state.values()) {
        s.stopped = false
        s.delay = POLL_MS
        s.nextAt = 0
      }
      if (stopTimer) void tick()
    },
    stop(): void {
      stopTimer?.()
      stopTimer = null
    }
  }
}
