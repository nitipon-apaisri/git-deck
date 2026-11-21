import { useState } from 'react'
import type { AccountType, ChangeRequest } from '@shared/types'
import { createUrl } from '../../lib/changeView'
import { errorMessage } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import { useNow } from '../../state/useNow'
import { useChangeRequests, useChecks } from '../../state/changeData'
import { Badge, Button, ErrorBanner, Skeleton, Spinner } from '../ui'
import { CheckDot } from '../ui/CheckDot'

interface Props {
  repoKey: string
  host: AccountType
  webUrl: string
  /** The tab is showing: only then is anything fetched. */
  active: boolean
}

const STATE_LABEL = { open: 'Open', merged: 'Merged', closed: 'Closed' } as const

export function ChangeRequestsTab({ repoKey, host, webUrl, active }: Props) {
  const { items, loading, error, reload } = useChangeRequests(repoKey, active)
  const [openError, setOpenError] = useState<string | null>(null)
  const noun = host === 'github' ? 'pull request' : 'merge request'
  const short = host === 'github' ? 'PR' : 'MR'

  async function open(url: string): Promise<void> {
    setOpenError(null)
    try {
      await window.api.openExternal(url)
    } catch (err) {
      setOpenError(errorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="m-0 text-[13px] font-semibold">
          {host === 'github' ? 'Pull requests' : 'Merge requests'}
        </h2>
        {loading ? <Spinner label={`Loading ${noun}s`} /> : null}
        <span className="flex-1" />
        <Button onClick={reload} disabled={loading}>
          Refresh
        </Button>
        <Button onClick={() => void open(createUrl(host, webUrl))}>Create {short}</Button>
      </div>
      {error ? <ErrorBanner onRetry={reload}>{error}</ErrorBanner> : null}
      {openError ? <ErrorBanner>{openError}</ErrorBanner> : null}
      {items === null ? (
        loading ? (
          <Skeleton className="h-16 w-full" />
        ) : null
      ) : items.length === 0 ? (
        <p className="m-0 text-[13px] text-muted-foreground">No {noun}s.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((cr) => (
            <Row key={cr.number} repoKey={repoKey} cr={cr} short={short} onOpen={open} />
          ))}
        </ul>
      )}
    </div>
  )
}

function Row({
  repoKey,
  cr,
  short,
  onOpen
}: {
  repoKey: string
  cr: ChangeRequest
  short: string
  onOpen: (url: string) => Promise<void>
}) {
  // Only open ones show CI: a merged or closed request has nothing to act on.
  const now = useNow()
  const checks = useChecks(repoKey, cr.state === 'open' ? cr.checksRef : null)
  return (
    <li className="flex items-start gap-3 rounded-lg bg-(--island) p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          {checks ? <CheckDot state={checks.state} /> : null}
          <span className="min-w-0 truncate text-[13px] font-medium">{cr.title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
          <Badge tone={cr.state === 'open' ? 'neutral' : 'warning'}>
            {cr.draft ? 'Draft' : STATE_LABEL[cr.state]}
          </Badge>
          <span>
            {short} #{cr.number} by {cr.author || 'unknown'} ·{' '}
            {timeAgo(Date.parse(cr.updatedAt), now)}
          </span>
          <span>
            {cr.sourceBranch} → {cr.targetBranch}
          </span>
          {cr.reviewers.length > 0 ? <span>Reviewers: {cr.reviewers.join(', ')}</span> : null}
          {cr.labels.map((l) => (
            <Badge key={l}>{l}</Badge>
          ))}
        </div>
      </div>
      <Button onClick={() => void onOpen(cr.webUrl)}>Open in browser</Button>
    </li>
  )
}
