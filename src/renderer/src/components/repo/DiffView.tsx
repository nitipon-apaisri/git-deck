import { useState } from 'react'
import { cn } from '@/lib/cn'
import { hunkFingerprint } from '@shared/diff'
import type { DiffLine } from '@shared/types'
import {
  buttonLabel,
  canSelectLines,
  selectAllChanged,
  selectRange,
  toggleLine,
  type LineSelection
} from '../../lib/lineSelection'
import {
  DIFF_LINE_LIMIT,
  diffTotalsText,
  limitHunks,
  visibleLineCount
} from '../../lib/changesView'
import type { DiffState } from '../../state/changesData'
import { Button, ErrorBanner, Icon, IconButton, Menu, Skeleton, type MenuEntry } from '../ui'

interface DiffViewProps {
  /** The file's path, shown in the header. */
  path: string
  state: DiffState
  onClose?: () => void
  /** Opens the file's history tab. */
  onHistory?: () => void
  /** Offered for a tracked file's staged or unstaged diff: one button per hunk. */
  hunkAction?: {
    label: string
    /** A stage or unstage is running, so the buttons wait. */
    busy: boolean
    onRun: (index: number, fingerprint: string, lines?: number[]) => void
    /** Direction of the per-line button. Present when single lines may be staged. */
    lineDirection?: 'stage' | 'unstage'
    /** Present for an unstaged diff: throws the ticked lines away (the host confirms). */
    onDiscard?: (index: number, fingerprint: string, lines: number[]) => void
  }
}

// Each line starts with + or −, so a change is never shown by colour alone.
const LINE: Record<DiffLine['type'], { mark: string; row: string; text: string }> = {
  add: { mark: '+', row: 'bg-(--success-bg)', text: 'text-(--success-text)' },
  del: {
    mark: '−',
    row: 'bg-[color-mix(in_srgb,var(--danger)_14%,transparent)]',
    text: 'text-destructive'
  },
  context: { mark: ' ', row: '', text: '' },
  note: { mark: '', row: '', text: 'text-muted-foreground italic' }
}

/** One file's changes as a unified diff, with old and new line numbers. */
export function DiffView({ path, state, onClose, onHistory, hunkAction }: DiffViewProps) {
  const { diff } = state
  const [expanded, setExpanded] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ h: number; x: number; y: number } | null>(null)
  const total = diff ? diff.hunks.reduce((n, h) => n + h.lines.length, 0) : 0
  type Picked = { hunk: number; lines: LineSelection; anchor: number }
  const none: Picked = { hunk: -1, lines: [], anchor: -1 }
  const [pickedRaw, setPickedRaw] = useState<Picked & { of: unknown }>({ of: null, ...none })
  // A reloaded diff is a new object with new fingerprints: a selection made on the old one is
  // ignored, so it never refers to a stale hunk.
  const picked: Picked = pickedRaw.of === diff ? pickedRaw : none
  const setPicked = (next: Picked | ((p: Picked) => Picked)) =>
    setPickedRaw((prev) => {
      const current = prev.of === diff ? prev : none
      return { of: diff, ...(typeof next === 'function' ? next(current) : next) }
    })
  const showAll = expanded === path
  const shown = diff ? limitHunks(diff.hunks, showAll ? total : visibleLineCount(total)) : []

  const menuEntries = (h: number): MenuEntry[] => {
    if (!hunkAction || !diff) return []
    const hunk = diff.hunks[h]
    const mine = picked.hunk === h ? picked.lines : []
    const fingerprint = hunkFingerprint(hunk.lines)
    const out: MenuEntry[] = [
      {
        kind: 'item',
        id: 'hunk',
        label: hunkAction.label,
        leading: (
          <Icon name={hunkAction.lineDirection === 'unstage' ? 'minus' : 'plus'} size="sm" />
        ),
        disabled: hunkAction.busy,
        onSelect: () => hunkAction.onRun(h, fingerprint)
      }
    ]
    if (hunkAction.lineDirection && canSelectLines(diff, hunk)) {
      out.push(
        {
          kind: 'item',
          id: 'all',
          label: 'Select all changed lines',
          leading: <Icon name="check" size="sm" />,
          onSelect: () => setPicked({ hunk: h, lines: selectAllChanged(hunk), anchor: -1 })
        },
        {
          kind: 'item',
          id: 'clear',
          label: 'Clear selection',
          leading: <Icon name="x" size="sm" />,
          disabled: mine.length === 0,
          onSelect: () => setPicked({ hunk: -1, lines: [], anchor: -1 })
        }
      )
      if (hunkAction.onDiscard) {
        out.push(
          { kind: 'separator', id: 'sep' },
          {
            kind: 'item',
            id: 'discard',
            label: `Discard ${mine.length} ${mine.length === 1 ? 'line' : 'lines'}`,
            leading: <Icon name="trash" size="sm" />,
            danger: true,
            disabled: hunkAction.busy || mine.length === 0,
            onSelect: () => hunkAction.onDiscard!(h, fingerprint, [...mine])
          }
        )
      }
    }
    return out
  }

  return (
    <section
      className="flex min-h-0 min-w-0 flex-col gap-2 rounded-lg bg-secondary p-3"
      aria-label={`Changes in ${path}`}
    >
      <div className="flex items-center gap-2">
        <h3 className="hash m-0 min-w-0 flex-1 truncate text-[13px] font-semibold" title={path}>
          {path}
        </h3>
        {diff && !diff.binary && !diff.tooLarge ? (
          <span className="flex-none font-mono text-[12px] text-muted-foreground">
            {diffTotalsText(diff.additions, diff.deletions)}
          </span>
        ) : null}
        {onHistory ? (
          <Button variant="ghost" onClick={onHistory}>
            History
          </Button>
        ) : null}
        {onClose ? <IconButton label="Close diff" icon="x" onClick={onClose} /> : null}
      </div>

      {state.loading && !diff ? (
        <div className="flex flex-col gap-2">
          <Skeleton label="Loading the diff" width="60%" />
          <Skeleton width="85%" />
          <Skeleton width="72%" />
        </div>
      ) : null}
      {state.error ? (
        <ErrorBanner onRetry={state.reload} retrying={state.loading}>
          Could not read this diff: {state.error}
        </ErrorBanner>
      ) : null}

      {diff?.binary ? <p className="m-0 text-muted-foreground">Binary file changed.</p> : null}
      {diff?.tooLarge ? (
        <p className="m-0 text-muted-foreground">
          This change is too large to show here. Open the folder to read it in an editor.
        </p>
      ) : null}
      {diff && !diff.binary && !diff.tooLarge && diff.hunks.length === 0 && !state.error ? (
        <p className="m-0 text-muted-foreground">No line changes to show.</p>
      ) : null}

      {diff && diff.hunks.length > 0 ? (
        <div
          className="min-h-0 overflow-auto rounded-md border border-border bg-background font-mono text-[12px] leading-4.5"
          role="region"
          aria-label="Diff lines"
          tabIndex={0}
        >
          <div className="w-max min-w-full">
            {shown.map((hunk, h) => {
              const lines = hunk.lines
              const splittable =
                !!hunkAction?.lineDirection && !!diff && canSelectLines(diff, diff.hunks[h])
              const mine = picked.hunk === h ? picked.lines : []
              return (
                <div key={h}>
                  <div className="flex items-center gap-2 bg-secondary px-3 py-0.5 text-muted-foreground">
                    <span className="min-w-0 flex-1">{hunk.header}</span>
                    {/* One sticky group, so the buttons never overlap when the header scrolls. */}
                    <div className="sticky right-2 flex flex-none items-center gap-1 bg-secondary">
                      {splittable && mine.length > 0 ? (
                        <Button
                          variant="ghost"
                          icon={hunkAction.lineDirection === 'stage' ? 'plus' : 'minus'}
                          className="h-6 px-2 text-[12px]"
                          title={buttonLabel(hunkAction.lineDirection!, mine.length)}
                          aria-label={buttonLabel(hunkAction.lineDirection!, mine.length)}
                          disabled={hunkAction.busy}
                          onClick={() =>
                            hunkAction.onRun(h, hunkFingerprint(diff!.hunks[h].lines), [...mine])
                          }
                        >
                          {mine.length}
                        </Button>
                      ) : null}
                      {hunkAction && diff ? (
                        <IconButton
                          label="Hunk actions"
                          icon="more"
                          className="size-6"
                          onClick={(e) => {
                            const r = e.currentTarget.getBoundingClientRect()
                            setMenu({ h, x: r.left, y: r.bottom + 4 })
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                  {lines.map((line, i) => {
                    const look = LINE[line.type]
                    const changed = line.type === 'add' || line.type === 'del'
                    return (
                      <div key={i} className={cn('flex whitespace-pre', look.row)}>
                        {hunkAction?.lineDirection &&
                        diff &&
                        canSelectLines(diff, diff.hunks[h]) ? (
                          <span className="flex w-6 flex-none items-center justify-center">
                            {changed ? (
                              <input
                                type="checkbox"
                                className="m-0 cursor-pointer accent-(--accent)"
                                checked={mine.includes(i)}
                                disabled={hunkAction.busy}
                                aria-label={
                                  line.type === 'add'
                                    ? `Select added line ${line.newNo}`
                                    : `Select removed line ${line.oldNo}`
                                }
                                onClick={(e) => {
                                  const hunkData = diff.hunks[h]
                                  setPicked((p) => {
                                    const base = p.hunk === h ? p.lines : []
                                    const next =
                                      e.shiftKey && p.hunk === h && p.anchor >= 0
                                        ? selectRange(base, hunkData, p.anchor, i)
                                        : toggleLine(base, hunkData, i)
                                    return { hunk: h, lines: next, anchor: i }
                                  })
                                }}
                                onChange={() => undefined}
                              />
                            ) : null}
                          </span>
                        ) : null}
                        <span
                          className="w-10 flex-none px-1 text-right text-muted-foreground select-none"
                          aria-hidden
                        >
                          {line.oldNo ?? ''}
                        </span>
                        <span
                          className="w-10 flex-none px-1 text-right text-muted-foreground select-none"
                          aria-hidden
                        >
                          {line.newNo ?? ''}
                        </span>
                        <span className={cn('w-4 flex-none text-center select-none', look.text)}>
                          {look.mark}
                        </span>
                        <span className={cn('pr-3', look.text)}>{line.text}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
      {total > DIFF_LINE_LIMIT && !showAll ? (
        <Button variant="ghost" onClick={() => setExpanded(path)}>
          Show all {total.toLocaleString('en-GB')} lines
        </Button>
      ) : null}
      {menu ? (
        <Menu
          label="Hunk actions"
          at={{ x: menu.x, y: menu.y }}
          entries={menuEntries(menu.h)}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </section>
  )
}
