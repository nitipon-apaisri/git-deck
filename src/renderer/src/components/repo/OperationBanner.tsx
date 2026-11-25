import { useState } from 'react'
import type { BisectMark, BisectState, OperationState } from '@shared/types'
import { conflictKindText } from '../../lib/conflictView'
import {
  bisectHint,
  bisectTitle,
  conflictPreview,
  operationHint,
  operationStepText,
  operationTitle
} from '../../lib/operationView'
import { Badge, Button, Icon } from '../ui'

/** A stopped operation waits for the user: an accent stripe, not a flat strip. */
const CARD =
  'flex animate-banner-in flex-col gap-3 rounded-md border-l-[3px] border-(--warning-text) bg-(--warning-bg) px-3.5 py-3 text-(--text) motion-reduce:animate-none'

interface OperationBannerProps {
  state: OperationState
  /** A write is running, so the buttons wait. */
  busy: boolean
  onContinue: () => void
  /** Main asks the user to confirm. */
  onAbort: () => void
  /** Rebase only: drop the commit it stopped on. Main asks the user to confirm. */
  onSkip?: () => void
  /** Opens the conflict editor for one of the files. */
  onResolveFile: (path: string) => void
  /** Opens the folder, for fixing a file in another editor. */
  onOpenFolder: () => void
}

/** A merge, cherry-pick, revert or rebase stopped and waits: what is left, and the way out. */
export function OperationBanner({
  state,
  busy,
  onContinue,
  onAbort,
  onSkip,
  onResolveFile,
  onOpenFolder
}: OperationBannerProps) {
  const [all, setAll] = useState(false)
  const step = operationStepText(state)
  const { shown, more } = conflictPreview(state.conflicted, all ? state.conflicted.length : 5)
  return (
    <section className={CARD} aria-label={operationTitle(state)} role="alert">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-none text-(--warning-text)">
          <Icon name="alert" size="sm" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 flex flex-wrap items-center gap-2 font-semibold">
            {operationTitle(state)}
            {step ? <Badge tone="warning">{step}</Badge> : null}
          </p>
          <p className="m-0 text-muted-foreground [overflow-wrap:anywhere]">
            {operationHint(state)}
          </p>
        </div>
      </div>
      {shown.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 pl-6 text-[12px]">
          {shown.map((path) => {
            const kind = state.conflictKinds[path]
            return (
              <li key={path} className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  className="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left font-mono text-[12px] text-inherit underline decoration-dotted underline-offset-2 [overflow-wrap:anywhere] hover:decoration-solid focus-visible:outline-2 focus-visible:outline-(--focus-ring)"
                  disabled={busy}
                  onClick={() => onResolveFile(path)}
                  aria-label={`Resolve ${path}`}
                >
                  {path}
                </button>
                {kind ? <Badge>{conflictKindText(kind)}</Badge> : null}
              </li>
            )
          })}
          {more > 0 ? (
            <li>
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-inherit underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-(--focus-ring)"
                onClick={() => setAll(true)}
              >
                Show {more} more
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 pl-6">
        <Button variant="primary" icon="check" disabled={busy} onClick={onContinue}>
          Continue
        </Button>
        {state.kind === 'rebase' && onSkip ? (
          <Button disabled={busy} onClick={onSkip}>
            Skip commit
          </Button>
        ) : null}
        <Button variant="danger" disabled={busy} onClick={onAbort}>
          Abort {state.kind}
        </Button>
        <Button variant="ghost" icon="folder" onClick={onOpenFolder}>
          Open folder
        </Button>
      </div>
    </section>
  )
}

interface BisectBannerProps {
  state: BisectState
  busy: boolean
  onMark: (mark: BisectMark) => void
  /** Abort while testing (main asks first), Finish at the result. */
  onReset: () => void
  onOpenCommit: (hash: string) => void
}

/** A running bisect: the commit under test with Good, Bad, Skip and Abort, then the result. */
export function BisectBanner({ state, busy, onMark, onReset, onOpenCommit }: BisectBannerProps) {
  const shown = state.result?.hash ?? state.current
  return (
    <section className={CARD} aria-label={bisectTitle(state)} role="status">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-none text-(--warning-text)">
          <Icon name="alert" size="sm" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 font-semibold">{bisectTitle(state)}</p>
          <p className="m-0 text-muted-foreground [overflow-wrap:anywhere]">{bisectHint(state)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-6">
        {state.result ? (
          <>
            <Button variant="primary" icon="check" disabled={busy} onClick={onReset}>
              Finish
            </Button>
            {shown ? (
              <Button variant="ghost" disabled={busy} onClick={() => onOpenCommit(shown)}>
                Open commit
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button disabled={busy} onClick={() => onMark('good')}>
              Good
            </Button>
            <Button disabled={busy} onClick={() => onMark('bad')}>
              Bad
            </Button>
            <Button disabled={busy} onClick={() => onMark('skip')}>
              Skip
            </Button>
            <Button variant="danger" disabled={busy} onClick={onReset}>
              Abort bisect
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
