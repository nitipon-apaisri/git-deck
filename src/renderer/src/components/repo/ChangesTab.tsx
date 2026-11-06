import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { StatusEntry } from '@shared/types'
import {
  commitBlocker,
  countText,
  groupStatus,
  keepSelection,
  rowLetter,
  rowWord,
  selectionRequest,
  splitPath,
  stagedKind,
  unstagedKind,
  type RowKind,
  type Selection
} from '../../lib/changesView'
import { errorMessage } from '../../lib/errors'
import { useDiff, useStatus } from '../../state/changesData'
import {
  Button,
  CheckOption,
  ErrorBanner,
  IconButton,
  Skeleton,
  Spinner,
  Textarea,
  type IconName
} from '../ui'
import { DiffView } from './DiffView'

interface ChangesTabProps {
  /** The linked folder, or `null` when this repository has none. */
  path: string | null
  /** Changes after any action in the pane, so this tab reads the folder again. */
  reloadToken: number
  /** Tells the pane that the folder changed, so the graph and Info reload too. */
  onChanged: () => void
  /** The tab is showing. It stays mounted so the message being written survives. */
  visible: boolean
  /** A narrow pane stacks the diff under the lists. */
  narrow: boolean
}

const LETTER_STYLE: Record<RowKind, string> = {
  added: 'text-[var(--success-text)]',
  untracked: 'text-[var(--success-text)]',
  deleted: 'text-destructive',
  conflicted: 'text-[var(--warning-text)]',
  modified: 'text-[var(--accent-text)]',
  renamed: 'text-[var(--accent-text)]',
  copied: 'text-[var(--accent-text)]',
  typechange: 'text-[var(--accent-text)]'
}

interface RowAction {
  label: string
  icon: IconName
  run: () => void
}

interface FileRowProps {
  entry: StatusEntry
  kind: RowKind
  selected: boolean
  disabled: boolean
  onSelect: () => void
  actions: RowAction[]
}

function FileRow({ entry, kind, selected, disabled, onSelect, actions }: FileRowProps) {
  const { dir, name } = splitPath(entry.path)
  return (
    <li
      className={cn(
        'flex min-h-[30px] items-center gap-1 rounded-md pr-1 pl-2',
        selected ? 'bg-accent' : 'hover:bg-accent/60'
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 py-1 text-left text-[12px] text-foreground"
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span
          className={cn('w-4 flex-none text-center font-mono font-semibold', LETTER_STYLE[kind])}
        >
          <span aria-hidden>{rowLetter(kind)}</span>
          <span className="sr-only">{rowWord(kind)}: </span>
        </span>
        <span
          className="hash min-w-0 flex-1 truncate"
          title={entry.origPath ? `${entry.origPath} → ${entry.path}` : entry.path}
        >
          <span className="text-muted-foreground">{dir}</span>
          {name}
        </span>
      </button>
      {actions.map((a) => (
        <IconButton
          key={a.label}
          label={`${a.label} ${entry.path}`}
          icon={a.icon}
          disabled={disabled}
          onClick={a.run}
        />
      ))}
    </li>
  )
}

interface SectionProps {
  title: string
  count: number
  action?: { label: string; run: () => void; disabled: boolean }
  children: React.ReactNode
}

function Section({ title, count, action, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-1" aria-label={title}>
      <div className="flex min-h-8 items-center gap-2">
        <h4 className="m-0 flex-1 text-[12px] leading-[18px] font-semibold text-muted-foreground">
          {title} · {count.toLocaleString('en-GB')}
        </h4>
        {action ? (
          <Button variant="ghost" disabled={action.disabled} onClick={action.run}>
            {action.label}
          </Button>
        ) : null}
      </div>
      <ul className="m-0 flex list-none flex-col p-0">{children}</ul>
    </section>
  )
}

/**
 * Staged and unstaged files, a diff for the one you pick, and the commit box. It
 * owns its own message, selection and busy state, like every other part of a pane.
 */
export function ChangesTab({ path, reloadToken, onChanged, visible, narrow }: ChangesTabProps) {
  const { status, loading, error, reload } = useStatus(path, reloadToken, visible)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const groups = groupStatus(status?.entries ?? [])
  const current = keepSelection(selected, groups)
  const diff = useDiff(path, current ? selectionRequest(current) : null, reloadToken)

  if (path === null) {
    return (
      <p className="m-0 text-muted-foreground">
        Clone or link this repository to a folder to see its changes.
      </p>
    )
  }

  async function act(work: () => Promise<unknown>): Promise<void> {
    setBusy(true)
    setProblem(null)
    try {
      await work()
    } catch (err) {
      setProblem(errorMessage(err))
    } finally {
      setBusy(false)
      // Even a failed action may have changed some files.
      onChanged()
    }
  }

  const files = (entries: StatusEntry[]): string[] => entries.map((e) => e.path)
  const blocker = commitBlocker({
    message,
    staged: groups.staged.length,
    conflicts: groups.conflicted.length,
    amend
  })

  async function commit(): Promise<void> {
    if (!path) return
    await act(async () => {
      await window.api.local.createCommit(path, message, amend)
      setMessage('')
      setAmend(false)
    })
  }

  const left = (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Textarea
          aria-label="Commit message"
          placeholder={amend ? 'Leave empty to keep the current message' : 'Commit message'}
          value={message}
          disabled={busy}
          onChange={(e) => setMessage(e.target.value)}
        />
        <CheckOption label="Amend the last commit" checked={amend} onChange={setAmend} />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Button
            variant="primary"
            icon="check"
            disabled={busy || blocker !== null}
            onClick={() => void commit()}
          >
            {amend ? 'Amend commit' : 'Commit'}
          </Button>
          {busy ? <Spinner label="Working" /> : null}
          <span className="min-w-0 flex-[1_1_8rem] text-[12px] text-muted-foreground">
            {blocker}
          </span>
        </div>
      </div>

      {problem ? <ErrorBanner onDismiss={() => setProblem(null)}>{problem}</ErrorBanner> : null}

      {groups.conflicted.length > 0 ? (
        <Section title="Conflicts" count={groups.conflicted.length}>
          {groups.conflicted.map((e) => (
            <FileRow
              key={e.path}
              entry={e}
              kind="conflicted"
              selected={false}
              disabled={busy}
              onSelect={() => setSelected(null)}
              actions={[
                {
                  label: 'Mark as resolved:',
                  icon: 'check',
                  run: () => void act(() => window.api.local.stage(path, [e.path]))
                }
              ]}
            />
          ))}
        </Section>
      ) : null}

      <Section
        title="Staged changes"
        count={groups.staged.length}
        action={
          groups.staged.length > 0
            ? {
                label: 'Unstage all',
                disabled: busy,
                run: () => void act(() => window.api.local.unstage(path, files(groups.staged)))
              }
            : undefined
        }
      >
        {groups.staged.map((e) => (
          <FileRow
            key={e.path}
            entry={e}
            kind={stagedKind(e)}
            selected={current?.source === 'staged' && current.path === e.path}
            disabled={busy}
            onSelect={() => setSelected({ source: 'staged', path: e.path })}
            actions={[
              {
                label: 'Unstage',
                icon: 'minus',
                run: () => void act(() => window.api.local.unstage(path, [e.path]))
              }
            ]}
          />
        ))}
      </Section>

      <Section
        title="Changes"
        count={groups.unstaged.length}
        action={
          groups.unstaged.length > 0
            ? {
                label: 'Stage all',
                disabled: busy,
                run: () => void act(() => window.api.local.stageAll(path))
              }
            : undefined
        }
      >
        {groups.unstaged.map((e) => (
          <FileRow
            key={e.path}
            entry={e}
            kind={unstagedKind(e)}
            selected={current?.source === 'worktree' && current.path === e.path}
            disabled={busy}
            onSelect={() => setSelected({ source: 'worktree', path: e.path })}
            actions={[
              {
                label: 'Discard changes to',
                icon: 'trash',
                run: () => void act(() => window.api.local.discard(path, [e.path]))
              },
              {
                label: 'Stage',
                icon: 'plus',
                run: () => void act(() => window.api.local.stage(path, [e.path]))
              }
            ]}
          />
        ))}
      </Section>

      {status && status.entries.length === 0 ? (
        <p className="m-0 text-muted-foreground">
          No changes. The working tree matches the last commit.
        </p>
      ) : null}
    </div>
  )

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-muted-foreground">
          {status
            ? `${countText(status.entries.length, 'changed file')}${status.branch ? ` on ${status.branch}` : ' (detached HEAD)'}`
            : ''}
        </span>
        <span className="flex-1" />
        {loading ? <Spinner label="Reading changes" /> : null}
        <IconButton label="Reload changes" icon="refresh" disabled={loading} onClick={reload} />
      </div>

      {error ? (
        <ErrorBanner onRetry={reload} retrying={loading}>
          {status ? 'Could not refresh the changes: ' : 'Could not read the changes: '}
          {error}
        </ErrorBanner>
      ) : null}

      {!status && loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton label="Reading changes" width="40%" />
          <Skeleton width="80%" />
          <Skeleton width="65%" />
        </div>
      ) : null}

      {status || !error ? (
        <div
          className={cn(
            'grid min-w-0 items-start gap-4',
            narrow ? 'grid-cols-1' : 'grid-cols-[minmax(260px,340px)_minmax(0,1fr)]'
          )}
        >
          {status ? left : null}
          {current ? (
            <DiffView path={current.path} state={diff} onClose={() => setSelected(null)} />
          ) : status && !narrow ? (
            <p className="m-0 text-muted-foreground">Select a file to see its changes.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
