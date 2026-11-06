import type { OperationState } from '@shared/types'
import { conflictPreview, operationHint, operationTitle } from '../../lib/operationView'
import { Button, Icon } from '../ui'

interface OperationBannerProps {
  state: OperationState
  /** A write is running, so the buttons wait. */
  busy: boolean
  onContinue: () => void
  /** Main asks the user to confirm. */
  onAbort: () => void
  /** Rebase only: drop the commit it stopped on. Main asks the user to confirm. */
  onSkip?: () => void
  /** Opens the folder, where the files are fixed. There is no conflict editor. */
  onOpenFolder: () => void
}

/** A merge, cherry-pick, revert or rebase stopped and waits: what is left, and the way out. */
export function OperationBanner({
  state,
  busy,
  onContinue,
  onAbort,
  onSkip,
  onOpenFolder
}: OperationBannerProps) {
  const { shown, more } = conflictPreview(state.conflicted)
  return (
    <section
      className="flex flex-col gap-2 rounded-md bg-[var(--warning-bg)] px-3 py-2 text-[var(--warning-text)]"
      aria-label={operationTitle(state)}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-none">
          <Icon name="alert" size="sm" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 font-semibold">{operationTitle(state)}</p>
          <p className="m-0 [overflow-wrap:anywhere]">{operationHint(state)}</p>
        </div>
      </div>
      {shown.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0 pl-6 font-mono text-[12px]">
          {shown.map((path) => (
            <li key={path} className="[overflow-wrap:anywhere]">
              {path}
            </li>
          ))}
          {more > 0 ? <li>and {more} more</li> : null}
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
        <Button disabled={busy} onClick={onAbort}>
          Abort {state.kind}
        </Button>
        <Button variant="ghost" icon="folder" onClick={onOpenFolder}>
          Open folder
        </Button>
      </div>
    </section>
  )
}
