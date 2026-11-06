import type { ReactNode } from 'react'
import type { Account, Repo } from '@shared/types'
import { Badge, IconButton } from '../ui'

interface RepoHeaderProps {
  repo: Repo
  account: Account | null
  /** Opened from a folder: no host, so no visibility, web link or account. */
  local?: boolean
  /** A narrow pane: buttons show only their icon. */
  compact?: boolean
  onOpenWeb: () => void
  /** Shows a close button when set (Split View only). */
  onClose?: () => void
  /** The repository actions (branch, fetch, pull, push, open folder), on the same row. */
  children?: ReactNode
}

export function RepoHeader({
  repo,
  // account,
  local = false,
  // compact,
  onOpenWeb,
  onClose,
  children
}: RepoHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {repo.archived ? <Badge tone="warning">Archived</Badge> : null}
            {repo.fork ? <Badge>Fork</Badge> : null}
          </div>
        </div>
        {children}
        <div className="flex flex-none items-center gap-1">
          {local ? null : (
            <IconButton
              label="Open on web"
              icon="external"
              className="size-9"
              onClick={onOpenWeb}
            />
          )}
          {onClose ? (
            <IconButton label="Close pane" icon="x" className="size-9" onClick={onClose} />
          ) : null}
        </div>
      </div>
      {repo.description && !local ? <p className="m-0 wrap-anywhere">{repo.description}</p> : null}
    </header>
  )
}
