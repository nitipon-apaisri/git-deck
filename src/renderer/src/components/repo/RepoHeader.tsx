import type { Account, Repo } from '@shared/types'
import { visibilityLabel } from '../../lib/repoView'
import { Badge, Button, Icon, IconButton } from '../ui'

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
}

export function RepoHeader({
  repo,
  account,
  local = false,
  compact = false,
  onOpenWeb,
  onClose
}: RepoHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h1 className="m-0 text-[20px] leading-[26px] font-semibold [overflow-wrap:anywhere]">
              {repo.name}
            </h1>
            {local ? (
              <Badge>Local</Badge>
            ) : (
              <Badge>
                {repo.visibility === 'private' ? <Icon name="lock" size="xs" /> : null}
                {visibilityLabel(repo.visibility)}
              </Badge>
            )}
            {repo.archived ? <Badge tone="warning">Archived</Badge> : null}
            {repo.fork ? <Badge>Fork</Badge> : null}
          </div>
          <p className="m-0 text-[12px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">
            {local ? 'Not on a host' : `${account ? `${account.label} · ` : ''}${repo.fullName}`}
          </p>
        </div>
        <div className="flex flex-none items-center gap-1">
          {local ? null : compact ? (
            <IconButton label="Open on web" icon="external" onClick={onOpenWeb} />
          ) : (
            <Button icon="external" onClick={onOpenWeb}>
              Open on web
            </Button>
          )}
          {onClose ? <IconButton label="Close pane" icon="x" onClick={onClose} /> : null}
        </div>
      </div>
      {repo.description && !local ? (
        <p className="m-0 [overflow-wrap:anywhere]">{repo.description}</p>
      ) : null}
    </header>
  )
}
