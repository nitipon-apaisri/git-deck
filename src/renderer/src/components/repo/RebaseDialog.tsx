import { useEffect, useState } from 'react'
import type { RebaseAction, RebasePlan } from '@shared/types'
import { errorMessage } from '../../lib/errors'
import {
  isUnchanged,
  moveRow,
  patchRow,
  REBASE_ACTION_OPTIONS,
  rebaseProblem,
  rowsFromPlan,
  toTodo,
  unchangedHint,
  type RebaseRow
} from '../../lib/rebaseView'
import { Button, Dialog, ErrorBanner, IconButton, Select, Spinner, Textarea } from '../ui'

interface RebaseDialogProps {
  /** The linked folder. */
  path: string
  /** The commit to rebase onto: the commits after it are listed. */
  base: string
  /** The rebase ran or stopped: graph, branches and the banner read it again. */
  onChanged: () => void
  onClose: () => void
}

/**
 * Reorder, reword, squash, fixup or drop the commits after `base`. A conflict leaves the rebase
 * running: the banner above the graph has Continue, Skip and Abort.
 */
export function RebaseDialog({ path, base, onChanged, onClose }: RebaseDialogProps) {
  const [plan, setPlan] = useState<RebasePlan | null>(null)
  const [rows, setRows] = useState<RebaseRow[]>([])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    window.api.local
      .rebasePlan(path, base)
      .then((next) => {
        if (!alive) return
        setPlan(next)
        setRows(rowsFromPlan(next))
      })
      .catch((err) => alive && setProblem(errorMessage(err)))
    return () => {
      alive = false
    }
  }, [path, base])

  const invalid = rebaseProblem(rows)
  const pushed = new Set(plan?.pushed)

  async function run(): Promise<void> {
    if (!plan || busy || invalid) return
    setBusy(true)
    setProblem(null)
    try {
      const result = await window.api.local.rebaseRun(path, base, toTodo(rows))
      if (result === null) return // declined at the confirm
      onChanged()
      onClose()
    } catch (err) {
      setProblem(errorMessage(err))
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Rebase interactively"
      description={`Commits after ${base.slice(0, 7)}, oldest first. Change them, then run.`}
      width={960}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!plan || busy || invalid !== null || isUnchanged(rows, plan)}
            onClick={() => void run()}
          >
            {busy ? 'Rebasing…' : 'Start rebase'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {problem ? <ErrorBanner onDismiss={() => setProblem(null)}>{problem}</ErrorBanner> : null}
        {!plan && !problem ? <Spinner /> : null}
        {plan && plan.pushed.length > 0 ? (
          <p className="m-0 text-warning">
            {plan.pushed.length} of these commits are already pushed. You will be asked first, and
            must force-push afterwards.
          </p>
        ) : null}
        {(invalid ?? (plan ? unchangedHint(rows, plan) : null)) ? (
          <p className="m-0 text-muted-foreground">
            {invalid ?? (plan ? unchangedHint(rows, plan) : null)}
          </p>
        ) : null}
        <ol className="m-0 flex list-none flex-col gap-1 p-0">
          {rows.map((row, i) => (
            <li
              key={row.hash}
              className={`flex flex-col gap-2 rounded-md bg-secondary py-2 pr-3 ${row.action === 'squash' || row.action === 'fixup' ? 'ml-6 pl-3' : 'pl-3'}`}
              data-dropped={row.action === 'drop' || undefined}
            >
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <IconButton
                    label="Move up"
                    icon="arrow-up"
                    disabled={busy || i === 0}
                    onClick={() => setRows(moveRow(rows, i, -1))}
                  />
                  <IconButton
                    label="Move down"
                    icon="arrow-down"
                    disabled={busy || i === rows.length - 1}
                    onClick={() => setRows(moveRow(rows, i, 1))}
                  />
                </div>
                <div className="w-56 shrink-0">
                  <Select
                    id={`rebase-action-${i}`}
                    options={REBASE_ACTION_OPTIONS}
                    value={row.action}
                    disabled={busy}
                    onChange={(value) =>
                      setRows(patchRow(rows, i, { action: value as RebaseAction }))
                    }
                  />
                </div>
                <code className="shrink-0 text-[12px] text-muted-foreground">
                  {row.hash.slice(0, 7)}
                </code>
                <span
                  className={`min-w-0 flex-1 truncate ${row.action === 'drop' ? 'line-through opacity-60' : ''}`}
                >
                  {row.subject}
                </span>
                {pushed.has(row.hash) ? (
                  <span className="text-[12px] text-warning">pushed</span>
                ) : null}
              </div>
              {row.action === 'reword' ? (
                <Textarea
                  data-autofocus
                  aria-label={`New message for ${row.hash.slice(0, 7)}`}
                  value={row.message}
                  rows={Math.min(6, row.message.split('\n').length + 1)}
                  maxLength={10000}
                  disabled={busy}
                  onChange={(e) => setRows(patchRow(rows, i, { message: e.target.value }))}
                />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </Dialog>
  )
}
