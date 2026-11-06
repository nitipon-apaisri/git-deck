import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { ConflictAction, ConflictChoice, ConflictFile, ConflictRegion } from '@shared/types'
import {
  actionHelp,
  actionLabel,
  canFinish,
  canSaveDraft,
  chooseAll,
  choiceText,
  conflictKindSentence,
  countLines,
  displayLine,
  editStart,
  emptyChoices,
  openCount,
  previewText,
  progressText,
  regionLines,
  regionsIn,
  savedText,
  sideTitle,
  sidesHint,
  unsupportedText,
  type RegionLines
} from '../../lib/conflictView'
import { errorMessage } from '../../lib/errors'
import { useConflictFile } from '../../state/conflictData'
import { Badge, Button, Dialog, ErrorBanner, Icon, Skeleton, Textarea } from '../ui'

interface ConflictEditorProps {
  /** The linked folder. */
  path: string
  /** The conflicted file, relative to the folder. */
  file: string
  /** Changes when the folder changes, so the file is read again. */
  reloadToken: number
  /** Tells the pane that the folder changed, so the banner, graph and Changes reload. */
  onChanged: () => void
  onClose: () => void
}

const CODE =
  'm-0 overflow-auto bg-background font-mono text-[12px] leading-[18px] whitespace-pre focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus-ring)]'

interface LinesProps {
  lines: string[]
  /** The file's line number of the first line, `null` for none. */
  from: number | null
  label: string
  className?: string
}

/** Lines with a gutter. The gutter is not text, so copying a block gives the code only. */
function Lines({ lines, from, label, className }: LinesProps) {
  return (
    <pre className={cn(CODE, 'max-h-56', className)} tabIndex={0} aria-label={label}>
      {lines.length === 0 ? (
        <span className="block px-3 py-1 text-muted-foreground italic">(empty)</span>
      ) : (
        lines.map((line, i) => (
          <span key={i} className="flex">
            <span
              className="w-10 flex-none px-1 text-right text-muted-foreground select-none"
              aria-hidden
            >
              {from === null ? '' : from + i}
            </span>
            <span className="pr-3 pl-2">{displayLine(line) || ' '}</span>
          </span>
        ))
      )}
    </pre>
  )
}

interface SideProps {
  title: string
  lines: string[]
  from: number
  chosen: boolean
}

function Side({ title, lines, from, chosen }: SideProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-md border',
        chosen ? 'border-primary' : 'border-border'
      )}
    >
      <div className="flex items-center gap-2 bg-card px-3 py-1.5 text-[12px]">
        <span className="min-w-0 flex-1 truncate font-semibold" title={title}>
          {title}
        </span>
        {chosen ? (
          <span className="inline-flex flex-none items-center gap-1 text-[var(--accent-text)]">
            <Icon name="check" size="sm" />
            Chosen
          </span>
        ) : null}
        <span className="flex-none text-muted-foreground">{countLines(lines.length)}</span>
      </div>
      <Lines lines={lines} from={from} label={`${title}, ${countLines(lines.length)}`} />
    </div>
  )
}

interface RegionCardProps {
  index: number
  total: number
  region: ConflictRegion
  at: RegionLines
  choice: ConflictChoice
  file: ConflictFile
  disabled: boolean
  onChoose: (choice: ConflictChoice) => void
}

function RegionCard({
  index,
  total,
  region,
  at,
  choice,
  file,
  disabled,
  onChoose
}: RegionCardProps) {
  const { labels } = file
  const eol = file.eol ?? '\n'
  const [draft, setDraft] = useState<string | null>(null)
  const ours = sideTitle(labels.ours, region.oursLabel)
  const theirs = sideTitle(labels.theirs, region.theirsLabel)
  const usesOurs = choice === 'ours' || choice === 'both'
  const usesTheirs = choice === 'theirs' || choice === 'both'
  const resolved = choice !== null

  return (
    <section
      className="flex flex-col gap-2 rounded-lg bg-secondary p-3"
      aria-label={`Conflict ${index + 1} of ${total}`}
    >
      <div className="flex items-center gap-2">
        <h4 className="m-0 min-w-0 flex-1 text-[13px] leading-[18px] font-semibold">
          Conflict {index + 1} of {total}
        </h4>
        <Badge tone={resolved ? 'neutral' : 'warning'}>
          <Icon name={resolved ? 'check' : 'alert'} size="sm" />
          {choiceText(choice, labels)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 max-[760px]:grid-cols-1">
        <Side title={ours} lines={region.ours} from={at.ours} chosen={usesOurs} />
        <Side title={theirs} lines={region.theirs} from={at.theirs} chosen={usesTheirs} />
      </div>

      {region.base && at.base !== null ? (
        <details className="rounded-md border border-border">
          <summary className="cursor-pointer px-3 py-1.5 text-[12px] text-muted-foreground">
            Common ancestor{region.baseLabel ? ` · ${region.baseLabel}` : ''} ·{' '}
            {countLines(region.base.length)}
          </summary>
          <Lines
            lines={region.base}
            from={at.base}
            label={`Common ancestor, ${countLines(region.base.length)}`}
          />
        </details>
      ) : null}

      {draft !== null ? (
        <div className="flex flex-col gap-2">
          <Textarea
            aria-label={`Edited result for conflict ${index + 1}`}
            className="font-mono text-[12px] leading-[18px]"
            rows={Math.min(14, Math.max(4, draft.split('\n').length + 1))}
            value={draft}
            spellCheck={false}
            data-autofocus
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              icon="check"
              disabled={disabled}
              onClick={() => {
                onChoose({ text: draft })
                setDraft(null)
              }}
            >
              Use this text
            </Button>
            <Button disabled={disabled} onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <span className="text-[12px] text-muted-foreground">
              An empty box removes these lines.
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={disabled} onClick={() => onChoose('ours')}>
            Accept {labels.ours}
          </Button>
          <Button disabled={disabled} onClick={() => onChoose('theirs')}>
            Accept {labels.theirs}
          </Button>
          <Button disabled={disabled} onClick={() => onChoose('both')}>
            Accept both
          </Button>
          {region.base ? (
            <Button disabled={disabled} onClick={() => onChoose('base')}>
              Accept the ancestor
            </Button>
          ) : null}
          <Button
            variant="ghost"
            icon="edit"
            disabled={disabled}
            onClick={() => setDraft(editStart(region, choice, eol))}
          >
            Edit result
          </Button>
          {resolved ? (
            <Button variant="ghost" disabled={disabled} onClick={() => onChoose(null)}>
              Undo
            </Button>
          ) : null}
        </div>
      )}
    </section>
  )
}

interface WholeFileProps {
  file: ConflictFile
  busy: boolean
  onRun: (action: ConflictAction) => void
}

/** A file with no regions to pick from: the actions that apply to the file as a whole. */
function WholeFile({ file, busy, onRun }: WholeFileProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-muted-foreground">
        {unsupportedText(file.unsupported ?? 'whole-file', file.detail)}
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {file.actions.map((action) => (
          <li key={action} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button
              variant={action === 'delete' ? 'default' : 'primary'}
              disabled={busy}
              onClick={() => onRun(action)}
            >
              {actionLabel(action, file.labels)}
            </Button>
            <span className="min-w-0 flex-1 text-[12px] text-muted-foreground">
              {actionHelp(action, file.labels)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Resolves one conflicted file, region by region. It owns its choices, so two panes can each
 * have an editor. Main re-reads the file when it saves and builds the text itself, so the
 * choices are all it sends.
 */
export function ConflictEditor({
  path,
  file,
  reloadToken,
  onChanged,
  onClose
}: ConflictEditorProps) {
  const { file: data, loading, error, reload } = useConflictFile(path, file, reloadToken)
  const [draft, setDraft] = useState<{ fingerprint: string | null; choices: ConflictChoice[] }>({
    fingerprint: null,
    choices: []
  })
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const regions = data ? regionsIn(data) : []
  // Choices belong to one reading of the file: a new reading starts again.
  const choices =
    data && draft.fingerprint === data.fingerprint ? draft.choices : data ? emptyChoices(data) : []
  const setChoices = (next: ConflictChoice[]): void =>
    setDraft({ fingerprint: data?.fingerprint ?? null, choices: next })
  const choose = (index: number, choice: ConflictChoice): void =>
    setChoices(choices.map((c, i) => (i === index ? choice : c)))

  async function work(job: () => Promise<void>): Promise<void> {
    setBusy(true)
    setProblem(null)
    setNote(null)
    try {
      await job()
    } catch (err) {
      setProblem(errorMessage(err))
    } finally {
      setBusy(false)
      // Even a failed write may have changed the file.
      onChanged()
    }
  }

  const save = (): Promise<void> =>
    work(async () => {
      if (!data?.fingerprint) return
      const result = await window.api.local.resolveConflict(path, {
        path: file,
        fingerprint: data.fingerprint,
        choices
      })
      if (result.staged) onClose()
      else setNote(savedText(result))
    })

  const runAction = (action: ConflictAction): Promise<void> =>
    work(async () => {
      // `false`: the user declined the confirm, and nothing changed.
      if (await window.api.local.resolveConflictFile(path, file, action)) onClose()
    })

  const markable = data?.actions.includes('mark-resolved') ?? false
  const lines = data ? regionLines(data) : []
  const preview = data && data.segments ? previewText(data, choices) : ''

  return (
    <Dialog
      title={`Resolve ${file}`}
      description={data ? conflictKindSentence(data.kind, data.labels) : undefined}
      width={960}
      onClose={onClose}
      actionsStart={
        data?.segments && regions.length > 0 ? (
          <span className="text-[12px] text-muted-foreground" role="status">
            {note ?? progressText(choices)}
          </span>
        ) : undefined
      }
      actions={
        data?.segments && regions.length > 0 ? (
          <>
            <Button disabled={busy} onClick={onClose}>
              Close
            </Button>
            {!canFinish(choices) ? (
              <Button disabled={busy || !canSaveDraft(choices)} onClick={() => void save()}>
                Save for later
              </Button>
            ) : null}
            <Button
              variant="primary"
              icon="check"
              disabled={busy || !canFinish(choices)}
              onClick={() => void save()}
            >
              Save and mark resolved
            </Button>
          </>
        ) : (
          <Button disabled={busy} onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {data ? (
        <p className="m-0 text-[12px] text-muted-foreground">
          {sidesHint(data.operation, data.labels)}
        </p>
      ) : null}
      {error ? (
        <ErrorBanner onRetry={reload} retrying={loading}>
          Could not read this file: {error}
        </ErrorBanner>
      ) : null}
      {problem ? <ErrorBanner onDismiss={() => setProblem(null)}>{problem}</ErrorBanner> : null}
      {!data && loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton label="Reading the file" width="50%" />
          <Skeleton width="85%" />
          <Skeleton width="70%" />
        </div>
      ) : null}

      {data && data.unsupported ? (
        <WholeFile file={data} busy={busy} onRun={(a) => void runAction(a)} />
      ) : null}

      {data && data.segments && regions.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-muted-foreground">
            No conflict markers are left in this file. Mark it as resolved to stage it as it is.
          </p>
          <div>
            <Button
              variant="primary"
              icon="check"
              disabled={busy || !markable}
              onClick={() => void runAction('mark-resolved')}
            >
              Mark as resolved
            </Button>
          </div>
        </div>
      ) : null}

      {data && data.segments && regions.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-muted-foreground">All conflicts:</span>
            <Button disabled={busy} onClick={() => setChoices(chooseAll(data, 'ours'))}>
              Accept {data.labels.ours}
            </Button>
            <Button disabled={busy} onClick={() => setChoices(chooseAll(data, 'theirs'))}>
              Accept {data.labels.theirs}
            </Button>
            {openCount(choices) < choices.length ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setChoices(emptyChoices(data))}
              >
                Undo all
              </Button>
            ) : null}
          </div>
          {regions.map((region, i) => (
            <RegionCard
              key={`${data.fingerprint}:${i}`}
              index={i}
              total={regions.length}
              region={region}
              at={lines[i]}
              choice={choices[i] ?? null}
              file={data}
              disabled={busy}
              onChoose={(c) => choose(i, c)}
            />
          ))}
          <details
            className="rounded-lg border border-border"
            open={previewOpen}
            onToggle={(e) => setPreviewOpen(e.currentTarget.open)}
          >
            <summary className="cursor-pointer px-3 py-2 text-[13px] font-semibold">
              Result preview
            </summary>
            <Lines
              lines={preview.split('\n').slice(0, preview.endsWith('\n') ? -1 : undefined)}
              from={1}
              label="The file as it would be saved"
              className="max-h-72"
            />
            {openCount(choices) > 0 ? (
              <p className="m-0 px-3 py-2 text-[12px] text-muted-foreground">
                Conflicts that are not resolved yet keep their markers here.
              </p>
            ) : null}
          </details>
        </>
      ) : null}
    </Dialog>
  )
}
