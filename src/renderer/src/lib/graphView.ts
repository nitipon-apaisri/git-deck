// Pure view-model helpers for the commit graph. No DOM, so they run under tsx.
import type { GraphEdge, GraphRow } from '../../../shared/graph-layout'
import type {
  CheckoutTarget,
  CheckState,
  CommitDetail,
  GraphCommit,
  GraphRef
} from '../../../shared/types'
import { timeAgo } from './format'
import { unixDateText } from './repoView'

export const PAGE_SIZE = 500
export const ROW_HEIGHT = 28
export const OVERSCAN = 10
/** Load the next page when the view is this many rows from the end. */
export const LOAD_AHEAD_ROWS = 20
export const LANE_WIDTH = 16
export const NODE_RADIUS = 5
/** Space left of the first lane, so a node and its ring are not clipped. */
export const LANE_PAD = 14
/** The lane colours `--lane-1` to `--lane-6` repeat. */
export const LANE_COLORS = 6
/** Changed files drawn before "Show all". */
export const FILE_LIMIT = 300

// Geometry

/** Centre of a lane, in px from the left edge of the row graph. */
export const laneX = (lane: number): number => LANE_PAD + lane * LANE_WIDTH

/** Width of the graph column for `lanes` lanes. */
export const graphWidth = (lanes: number): number =>
  LANE_PAD * 2 + (Math.max(1, lanes) - 1) * LANE_WIDTH

const MID = ROW_HEIGHT / 2

/**
 * SVG path of one edge inside a row that is `ROW_HEIGHT` high with the node at the
 * vertical centre. `through` is a vertical line. `top` and `bottom` leave the node
 * with a cubic curve whose control points sit at the vertical midpoint of the half row.
 */
export function edgePath(edge: GraphEdge): string {
  const from = laneX(edge.from)
  const to = laneX(edge.to)
  if (edge.part === 'through') return `M${from} 0V${ROW_HEIGHT}`
  if (edge.part === 'top') {
    if (from === to) return `M${from} 0V${MID}`
    const y = MID / 2
    return `M${from} 0C${from} ${y} ${to} ${y} ${to} ${MID}`
  }
  if (from === to) return `M${from} ${MID}V${ROW_HEIGHT}`
  const y = MID + MID / 2
  return `M${from} ${MID}C${from} ${y} ${to} ${y} ${to} ${ROW_HEIGHT}`
}

/** 1..6, the `--lane-n` token for a colour index. */
export const laneTone = (color: number): number =>
  (((color % LANE_COLORS) + LANE_COLORS) % LANE_COLORS) + 1

// Virtual list

export interface Range {
  /** First row to draw. */
  start: number
  /** One past the last row to draw. */
  end: number
}

/** Rows to draw for a scroll position: the visible ones plus `overscan` either side. */
export function visibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowCount: number,
  rowHeight = ROW_HEIGHT,
  overscan = OVERSCAN
): Range {
  if (rowCount <= 0 || viewportHeight <= 0) return { start: 0, end: 0 }
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight)
  const last = Math.ceil((Math.max(0, scrollTop) + viewportHeight) / rowHeight)
  const end = Math.min(rowCount, last + overscan)
  return { start: Math.min(end, Math.max(0, first - overscan)), end }
}

export interface PagingView {
  scrollTop: number
  viewportHeight: number
  rowCount: number
  done: boolean
  loading: boolean
  error: boolean
}

/**
 * True when the next page should load: the view is within `LOAD_AHEAD_ROWS` of the
 * end, or the loaded rows do not even fill the viewport. A failed page is not
 * retried by scrolling, so a broken repository cannot loop.
 */
export function needsNextPage(v: PagingView): boolean {
  if (v.done || v.loading || v.error || v.viewportHeight <= 0) return false
  const contentHeight = v.rowCount * ROW_HEIGHT
  return contentHeight - (v.scrollTop + v.viewportHeight) <= LOAD_AHEAD_ROWS * ROW_HEIGHT
}

/** The widest lane count among the rows being drawn, so the graph column fits them all. */
export function widestLane(widths: readonly number[]): number {
  return widths.reduce((max, w) => Math.max(max, w), 1)
}

/** Row index after a navigation key, or `null` when the key is not one. */
export function moveIndex(
  key: string,
  current: number | null,
  rowCount: number,
  page: number
): number | null {
  if (rowCount <= 0) return null
  const last = rowCount - 1
  const at = current ?? -1
  switch (key) {
    case 'ArrowDown':
      return Math.min(last, at + 1)
    case 'ArrowUp':
      return Math.max(0, current === null ? 0 : at - 1)
    case 'PageDown':
      return Math.min(last, at + page)
    case 'PageUp':
      return Math.max(0, current === null ? 0 : at - page)
    case 'Home':
      return 0
    case 'End':
      return last
    default:
      return null
  }
}

/** New `scrollTop` that brings row `index` fully into view, or the same one if it is. */
export function scrollToRow(
  index: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight = ROW_HEIGHT
): number {
  const top = index * rowHeight
  if (top < scrollTop) return top
  if (top + rowHeight > scrollTop + viewportHeight) return top + rowHeight - viewportHeight
  return scrollTop
}

// Refs

export type BadgeKind = 'head' | 'main' | 'feature' | 'project' | 'tag'

export interface BadgeView {
  kind: BadgeKind
  /** What the ref is in git, for the right-click menu. `kind` is only its look. */
  refKind: GraphRef['kind']
  name: string
  /** The checked-out branch, drawn heavier. */
  current: boolean
}

const KIND_ORDER: Record<GraphRef['kind'], number> = { head: 0, branch: 1, remote: 2, tag: 3 }

/**
 * HEAD, local branches, remote branches, tags (the design system order). The default
 * branch and its remote twin get the `main` look, other local branches `feature`,
 * other remote branches `project`.
 */
export function badgeViews(refs: readonly GraphRef[], defaultBranch: string): BadgeView[] {
  return refs
    .map((ref, index) => ({ ref, index }))
    .sort((a, b) => KIND_ORDER[a.ref.kind] - KIND_ORDER[b.ref.kind] || a.index - b.index)
    .map(({ ref }): BadgeView => {
      const current = ref.current === true
      switch (ref.kind) {
        case 'head':
          return { kind: 'head', refKind: 'head', name: ref.name, current: false }
        case 'tag':
          return { kind: 'tag', refKind: 'tag', name: ref.name, current: false }
        case 'branch':
          return {
            kind: ref.name === defaultBranch ? 'main' : 'feature',
            refKind: 'branch',
            name: ref.name,
            current
          }
        case 'remote':
          return {
            kind: defaultBranch && ref.name.endsWith(`/${defaultBranch}`) ? 'main' : 'project',
            refKind: 'remote',
            name: ref.name,
            current: false
          }
      }
    })
}

/** One pill in the branch / tag column: a local branch and its remote twin share one. */
/** CI state of one branch, drawn as a dot on its pill. */
export interface BranchCheck {
  branch: string
  state: CheckState
}

export interface RefPill {
  key: string
  kind: BadgeKind
  name: string
  /** Checked out: drawn with a tick. */
  current: boolean
  local: boolean
  remote: boolean
  tag: boolean
  /** Every full ref name on it, for the tooltip. */
  title: string
  /** The ref the right-click menu acts on: the local branch when there is one. */
  badge: BadgeView
}

/**
 * The pills for a commit: a detached HEAD, the checked-out branch, other local branches, remote-only
 * branches, then tags. `origin/x` joins local `x`. HEAD is left out when a branch is checked out.
 */
export function refPills(refs: readonly GraphRef[], defaultBranch: string): RefPill[] {
  const views = badgeViews(refs, defaultBranch)
  const branches = views.filter((v) => v.refKind === 'branch')
  const remotes = views.filter((v) => v.refKind === 'remote')
  const twin = new Set<BadgeView>()
  const pills: RefPill[] = []
  const pill = (badge: BadgeView, extra: Partial<RefPill>, names: string[]): RefPill => ({
    key: `${badge.refKind}:${badge.name}`,
    kind: badge.kind,
    name: badge.name,
    current: badge.current,
    local: false,
    remote: false,
    tag: false,
    title: names.join('\n'),
    badge,
    ...extra
  })
  if (!branches.some((b) => b.current)) {
    for (const v of views) if (v.refKind === 'head') pills.push(pill(v, {}, [v.name]))
  }
  const locals = [...branches].sort((a, b) => Number(b.current) - Number(a.current))
  for (const b of locals) {
    // A remote ref is `remote/branch`; the remote's own name has no slash.
    const match = remotes.find((r) => r.name.slice(r.name.indexOf('/') + 1) === b.name)
    if (match) twin.add(match)
    const names = [b.current ? `${b.name} (checked out)` : b.name, ...(match ? [match.name] : [])]
    pills.push(pill(b, { local: true, remote: match !== undefined }, names))
  }
  for (const r of remotes) if (!twin.has(r)) pills.push(pill(r, { remote: true }, [r.name]))
  for (const t of views) if (t.refKind === 'tag') pills.push(pill(t, { tag: true }, [t.name]))
  return pills
}

/**
 * The branch a commit is drawn on, for the faded pill shown while the pointer is over a commit with
 * no refs of its own: the branch ref at the tip of the commit's lane. Walks up the lane. Null when
 * the lane starts at a merge's second parent (the branch is gone) or its tip has no branch.
 */
export function laneBranchPill(
  rows: readonly GraphRow[],
  index: number,
  defaultBranch: string
): RefPill | null {
  const lane = rows[index].lane
  for (let k = index; k >= 0; k--) {
    const r = rows[k]
    if (r.lane === lane) {
      const pill = refPills(r.commit.refs, defaultBranch).find(
        (p) => !p.tag && p.badge.refKind !== 'head'
      )
      if (pill) return pill
      if (!r.edges.some((e) => e.part === 'top')) return null // a tip with no branch
    } else if (
      // A merge's second parent opened this lane; a "through" edge means it was already open.
      r.edges.some((e) => e.part === 'bottom' && e.to === lane) &&
      !r.edges.some((e) => e.part === 'through' && e.from === lane)
    ) {
      return null
    }
  }
  return null
}

/** What a double-click on a badge checks out: a branch, or a remote branch (git reuses a local twin). HEAD and tags: nothing. */
export function badgeCheckoutTarget(badge: BadgeView): CheckoutTarget | null {
  if (badge.refKind === 'branch') return { kind: 'branch', name: badge.name }
  if (badge.refKind === 'remote') return { kind: 'remote', name: badge.name }
  return null
}

/** Branches and remote branches can be checked out from a pill; HEAD and tags cannot. */
export const pillClickable = (pill: RefPill): boolean => badgeCheckoutTarget(pill.badge) !== null

/** HEAD is drawn as a ring. A detached HEAD is a `head` ref with no branch beside it. */
/** Hash of the "// WIP" row: uncommitted changes drawn as a commit on top of HEAD. */
export const WIP_HASH = 'WIP'

/** The synthetic commit the layout draws for uncommitted changes. */
export const wipCommit = (head: string): GraphCommit => ({
  hash: WIP_HASH,
  parents: [head],
  author: '',
  email: '',
  date: 0,
  refs: [],
  subject: ''
})

export const isWipHash = (hash: string): boolean => hash === WIP_HASH

export const isHeadCommit = (refs: readonly GraphRef[]): boolean =>
  refs.some((ref) => ref.kind === 'head')

// Text

/** "5 min ago" for the last month, then a date. */
export function commitDateText(unixSeconds: number, now: number, locale = 'en-GB'): string {
  const ageMs = now - unixSeconds * 1000
  if (ageMs < 30 * 24 * 3600 * 1000) return timeAgo(unixSeconds * 1000, now)
  return unixDateText(unixSeconds, locale)
}

/** Full local date and time for a tooltip. */
export function commitDateTitle(unixSeconds: number, locale = 'en-GB'): string {
  const date = new Date(unixSeconds * 1000)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'medium' })
}

export const authorLabel = (name: string, email: string): string =>
  name.trim() || email || 'Unknown'

export interface FileTotals {
  files: number
  additions: number
  deletions: number
  binary: number
}

export function fileTotals(files: CommitDetail['files']): FileTotals {
  const totals: FileTotals = { files: files.length, additions: 0, deletions: 0, binary: 0 }
  for (const f of files) {
    if (f.additions === null || f.deletions === null) totals.binary += 1
    else {
      totals.additions += f.additions
      totals.deletions += f.deletions
    }
  }
  return totals
}

/** "3 files changed, +12 −4". */
export function fileTotalsText(t: FileTotals): string {
  if (t.files === 0) return 'No file changes'
  const noun = t.files === 1 ? 'file' : 'files'
  return `${t.files.toLocaleString('en-GB')} ${noun} changed, +${t.additions.toLocaleString('en-GB')} −${t.deletions.toLocaleString('en-GB')}`
}

/** `+12` or `binary`. */
export const additionsText = (n: number | null): string => (n === null ? 'binary' : `+${n}`)
export const deletionsText = (n: number | null): string => (n === null ? '' : `−${n}`)

/** "1 commit loaded" / "1,200 commits loaded". */
export function loadedText(count: number, done: boolean): string {
  const noun = count === 1 ? 'commit' : 'commits'
  return `${count.toLocaleString('en-GB')} ${noun} loaded${done ? '' : '…'}`
}

/** The message body without its first line, which the panel shows as the title. */
export function bodyText(message: string, subject: string): string {
  const full = message.trim()
  const title = subject.trim()
  if (title && full.startsWith(title)) return full.slice(title.length).trim()
  return full
}
