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
import { Button, ErrorBanner, IconButton, Skeleton } from '../ui'

interface DiffViewProps {
  /** The file's path, shown in the header. */
  path: string
  state: DiffState
  onClose?: () => void
  /** Offered for a tracked file's staged or unstaged diff: one button per hunk. */
  hunkAction?: {
    label: string
    /** A stage or unstage is running, so the buttons wait. */
    busy: boolean
    onRun: (index: number, fingerprint: string, lines?: number[]) => void
    /** Direction of the per-line button. Present when single lines may be staged. */
    lineDirection?: 'stage' | 'unstage'
  }
}

// Each line starts with + or −, so a change is never shown by colour alone.
const LINE: Record<DiffLine['type'], { mark: string; row: string; text: string }> = {
  add: { mark: '+', row: 'bg-[var(--success-bg)]', text: 'text-[var(--success-text)]' },
  del: {
    mark: '−',
    row: 'bg-[color-mix(in_srgb,var(--danger)_14%,transparent)]',
    text: 'text-destructive'
  },
  context: { mark: ' ', row: '', text: '' },
  note: { mark: '', row: '', text: 'text-muted-foreground italic' }
}

/** One file's changes as a unified diff, with old and new line numbers. */
export function DiffView({ path, state, onClose, hunkAction }: DiffViewProps) {
  const { diff } = state
  const [expanded, setExpanded] = useState<string | null>(null)
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
          className="min-h-0 overflow-auto rounded-md border border-border bg-background font-mono text-[12px] leading-[18px]"
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
                    {splittable && mine.length > 0 ? (
                      <Button
                        variant="ghost"
                        className="sticky right-2 h-6 flex-none px-2 text-[12px]"
                        disabled={hunkAction.busy}
                        onClick={() =>
                          hunkAction.onRun(h, hunkFingerprint(diff!.hunks[h].lines), [...mine])
                        }
                      >
                        {buttonLabel(hunkAction.lineDirection!, mine.length)}
                      </Button>
                    ) : null}
                    {splittable ? (
                      <>
                        <Button
                          variant="ghost"
                          className="h-6 flex-none px-2 text-[12px]"
                          onClick={() =>
                            setPicked({
                              hunk: h,
                              lines: selectAllChanged(diff!.hunks[h]),
                              anchor: -1
                            })
                          }
                        >
                          Select all
                        </Button>
                        {mine.length > 0 ? (
                          <Button
                            variant="ghost"
                            className="h-6 flex-none px-2 text-[12px]"
                            onClick={() => setPicked({ hunk: -1, lines: [], anchor: -1 })}
                          >
                            Clear
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                    {hunkAction && diff ? (
                      <Button
                        variant="ghost"
                        className="sticky right-2 h-6 flex-none px-2 text-[12px]"
                        disabled={hunkAction.busy}
                        // The fingerprint comes from the whole hunk, never from the shortened view.
                        onClick={() => hunkAction.onRun(h, hunkFingerprint(diff.hunks[h].lines))}
                      >
                        {hunkAction.label}
                      </Button>
                    ) : null}
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
                                className="m-0 cursor-pointer accent-[var(--accent)]"
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
    </section>
  )
}
