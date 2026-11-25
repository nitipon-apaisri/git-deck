// Pure PR/MR event differ for notifications: no electron, no I/O.
import type { ChangeRequest, NotifyEvent } from './types'

export const NOTIFY_EVENTS: readonly { id: NotifyEvent; label: string }[] = [
  { id: 'created', label: 'New PR/MR' },
  { id: 'merged', label: 'Merged' },
  { id: 'closed', label: 'Closed without merging' },
  { id: 'review', label: 'Reviewer requested' },
  { id: 'checksFailed', label: 'Checks failed' }
]

const IDS = new Set<string>(NOTIFY_EVENTS.map((e) => e.id))

export function isNotifyEvent(value: unknown): value is NotifyEvent {
  return typeof value === 'string' && IDS.has(value)
}

export interface ChangeEvent {
  kind: NotifyEvent
  cr: ChangeRequest
}

/** Events between two polls of one repo. The first load (`prev === null`) is the baseline. */
export function diffChangeRequests(
  prev: readonly ChangeRequest[] | null,
  next: readonly ChangeRequest[]
): ChangeEvent[] {
  if (prev === null) return []
  const before = new Map(prev.map((cr) => [cr.number, cr]))
  // Numbers only grow, so an old request that re-enters the 100-item window is not new.
  const highest = prev.reduce((max, cr) => Math.max(max, cr.number), 0)
  const events: ChangeEvent[] = []
  for (const cr of next) {
    const old = before.get(cr.number)
    if (!old) {
      if (cr.number > highest) events.push({ kind: 'created', cr })
      continue
    }
    if (old.state === 'open' && cr.state === 'merged') events.push({ kind: 'merged', cr })
    else if (old.state === 'open' && cr.state === 'closed') events.push({ kind: 'closed', cr })
    else if (
      cr.state === 'open' &&
      old.state === 'open' &&
      cr.reviewers.some((r) => !old.reviewers.includes(r))
    ) {
      events.push({ kind: 'review', cr })
    }
  }
  return events
}

const VERB: Record<NotifyEvent, string> = {
  created: 'opened',
  merged: 'merged',
  closed: 'closed',
  review: 'review requested',
  checksFailed: 'checks failed'
}

/** The notification body: number, what happened, title. Never a URL or token. */
export function noticeBody(kind: NotifyEvent, cr: Pick<ChangeRequest, 'number' | 'title'>): string {
  return `#${cr.number} ${VERB[kind]}: ${cr.title}`
}

export const ALL_NOTIFY_EVENTS: NotifyEvent[] = NOTIFY_EVENTS.map((e) => e.id)

export function allNotifyOn(events: readonly NotifyEvent[] | undefined): boolean {
  return ALL_NOTIFY_EVENTS.every((id) => events?.includes(id))
}

/** A repository's notification state: the projects that own it, and "on" if any has an event. */
export function repoNotifyState<P extends { repoKeys: string[]; notify?: NotifyEvent[] }>(
  projects: readonly P[],
  repoKey: string
) {
  const owners = projects.filter((p) => p.repoKeys.includes(repoKey))
  return { owners, on: owners.some((p) => (p.notify?.length ?? 0) > 0) }
}
