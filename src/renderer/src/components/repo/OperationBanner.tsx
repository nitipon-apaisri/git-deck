import { useState } from 'react'
import type { OperationState } from '@shared/types'
import { conflictKindText } from '../../lib/conflictView'
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
  const { shown, more } = conflictPreview(state.conflicted, all ? state.conflicted.length : 5)
  return (
    <section
      className="flex flex-col gap-2 rounded-md bg-(--warning-bg) px-3 py-2 text-(--warning-text)"
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
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0 pl-6 text-[12px]">
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
                {kind ? <span className="flex-none">({conflictKindText(kind)})</span> : null}
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
