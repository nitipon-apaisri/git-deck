import { useState } from 'react'
import { useAiEnabled } from '../../state/ai'
import { cn } from '@/lib/cn'
import type { RepoStatus, StatusEntry } from '@shared/types'
import {
  commitBlocker,
  countText,
  groupStatus,
  rowLetter,
  rowWord,
  splitPath,
  stagedKind,
  unstagedKind,
  type RowKind
} from '../../lib/changesView'
import { quickAction } from '../../lib/conflictView'
import { errorMessage } from '../../lib/errors'
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

interface ChangesPanelProps {
  /** The linked folder. */
  path: string
  /** Read by the graph, which also needs it for the "// WIP" row. */
  status: RepoStatus | null
  loading: boolean
  error: string | null
  reload: () => void
  /** Tells the pane that the folder changed, so the graph and Info reload too. */
  onChanged: () => void
  /** Opens a file's diff. */
  onOpenFile: (source: 'staged' | 'worktree', path: string) => void
  /** Opens the conflict editor for a file in conflict. */
  onResolveFile: (path: string) => void
  onClose: () => void
  /** Not the selected row: stays mounted but out of sight. */
  hidden: boolean
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
 * Staged and unstaged files and the commit box, in the graph's side panel while the
 * "// WIP" row is selected. It owns its message and busy state, like every other part
 * of a pane, and the graph keeps it mounted so the message survives.
 */
export function ChangesPanel({
  path,
  status,
  loading,
  error,
  reload,
  onChanged,
  onOpenFile,
  onResolveFile,
  onClose,
  hidden
}: ChangesPanelProps) {
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const aiEnabled = useAiEnabled()

  const groups = groupStatus(status?.entries ?? [])

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

  // Only fills the message field. It does not go through `act`: nothing on disk changes.
  async function generate(): Promise<void> {
    setGenerating(true)
    setProblem(null)
    try {
      setMessage(await window.api.local.suggestCommitMessage(path))
    } catch (err) {
      setProblem(errorMessage(err))
    } finally {
      setGenerating(false)
    }
  }

  async function commit(): Promise<void> {
    await act(async () => {
      await window.api.local.createCommit(path, message, amend)
      setMessage('')
      setAmend(false)
    })
  }

  const body = (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="relative flex flex-col">
          <Textarea
            aria-label="Commit message"
            placeholder={amend ? 'Leave empty to keep the current message' : 'Commit message'}
            value={message}
            disabled={busy}
            className={aiEnabled ? 'pr-10' : undefined}
            onChange={(e) => setMessage(e.target.value)}
          />
          {aiEnabled ? (
            <span className="absolute top-1 right-1 grid size-8 place-items-center">
              {generating ? (
                <Spinner label="Writing a message" />
              ) : (
                <IconButton
                  label="Generate a message from the staged changes"
                  icon="sparkles"
                  disabled={busy || groups.staged.length === 0 || groups.conflicted.length > 0}
                  onClick={() => void generate()}
                />
              )}
            </span>
          ) : null}
        </div>
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
              onSelect={() => onResolveFile(e.path)}
              actions={[
                {
                  label: 'Resolve conflicts in',
                  icon: 'edit',
                  run: () => onResolveFile(e.path)
                },
                {
                  label: 'Mark as resolved:',
                  icon: 'check',
                  run: () =>
                    void act(() =>
                      window.api.local.resolveConflictFile(path, e.path, quickAction(e.conflict))
                    )
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
            selected={false}
            disabled={busy}
            onSelect={() => onOpenFile('staged', e.path)}
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
            selected={false}
            disabled={busy}
            onSelect={() => onOpenFile('worktree', e.path)}
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
    <aside
      className="flex min-h-0 min-w-0 flex-col rounded-lg bg-secondary [&[hidden]]:hidden"
      aria-label="Uncommitted changes"
      hidden={hidden}
    >
      <div className="flex items-start gap-2 px-3 pt-3 pb-2">
        <h3 className="m-0 min-w-0 flex-1 text-[15px] leading-[22px] font-semibold [overflow-wrap:anywhere]">
          {status
            ? `${countText(status.entries.length, 'changed file')}${status.branch ? ` on ${status.branch}` : ' (detached HEAD)'}`
            : 'Changes'}
        </h3>
        {loading ? <Spinner label="Reading changes" /> : null}
        <IconButton label="Reload changes" icon="refresh" disabled={loading} onClick={reload} />
        <IconButton label="Close changes" icon="x" onClick={onClose} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 pb-3">
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
        {status ? body : null}
      </div>
    </aside>
  )
}
