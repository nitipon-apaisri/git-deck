import { useState } from 'react'
import type { AccountType, BranchList, ChangeRequest } from '@shared/types'
import { CHECK_LABEL, createUrl } from '../../lib/changeView'
import { errorMessage } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import { useNow } from '../../state/useNow'
import { useChangeRequests, useChecks } from '../../state/changeData'
import { Badge, Button, ErrorBanner, Skeleton, Spinner } from '../ui'
import { CheckDot } from '../ui/CheckDot'
import { CreateChangeRequestDialog } from './CreateChangeRequestDialog'

interface Props {
  repoKey: string
  host: AccountType
  webUrl: string
  defaultBranch: string
  /** The clone and its branches; without them the dialog cannot read or push, so the browser link stays. */
  linkedPath?: string
  branches?: BranchList | null
  /** The tab is showing: only then is anything fetched. */
  active: boolean
}

const STATE_LABEL = { open: 'Open', merged: 'Merged', closed: 'Closed' } as const
const STATE_TONE = { open: 'success', merged: 'merged', closed: 'danger' } as const
const FILTERS = ['all', 'open', 'merged', 'closed'] as const
type Filter = (typeof FILTERS)[number]

export function ChangeRequestsTab({
  repoKey,
  host,
  webUrl,
  defaultBranch,
  linkedPath,
  branches,
  active
}: Props) {
  const { items, loading, error, reload } = useChangeRequests(repoKey, active)
  const [filter, setFilter] = useState<Filter>('all')
  const [openError, setOpenError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const noun = host === 'github' ? 'pull request' : 'merge request'
  const short = host === 'github' ? ('PR' as const) : ('MR' as const)

  const shown = (items ?? []).filter((c) => filter === 'all' || c.state === filter)

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
        <h2 className="m-0 text-[15px] leading-5.5 font-semibold">
          {host === 'github' ? 'Pull requests' : 'Merge requests'}
        </h2>
        {loading ? <Spinner label={`Loading ${noun}s`} /> : null}
        <span className="flex-1" />
        <Button onClick={reload} disabled={loading}>
          Refresh
        </Button>
        <Button
          onClick={() =>
            linkedPath && branches?.current ? setCreating(true) : void open(createUrl(host, webUrl))
          }
        >
          Create {short}
        </Button>
      </div>
      {creating && linkedPath && branches ? (
        <CreateChangeRequestDialog
          repoKey={repoKey}
          linkedPath={linkedPath}
          branches={branches}
          defaultBranch={defaultBranch}
          short={short}
          fallbackUrl={createUrl(host, webUrl)}
          onClose={() => setCreating(false)}
          onCreated={(cr) => {
            setCreating(false)
            reload()
            if (cr.webUrl) void open(cr.webUrl)
          }}
        />
      ) : null}
      {error ? <ErrorBanner onRetry={reload}>{error}</ErrorBanner> : null}
      {openError ? <ErrorBanner>{openError}</ErrorBanner> : null}
      {items && items.length > 0 ? (
        <div role="group" aria-label="Filter by status" className="flex gap-1.5">
          {FILTERS.map((f) => {
            const count = f === 'all' ? items.length : items.filter((c) => c.state === f).length
            return (
              <Button
                key={f}
                variant={filter === f ? 'primary' : 'default'}
                className="h-8 px-3"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : STATE_LABEL[f]} {count}
              </Button>
            )
          })}
        </div>
      ) : null}
      {items === null ? (
        loading ? (
          <Skeleton className="h-16 w-full" />
        ) : null
      ) : items.length === 0 ? (
        <p className="m-0 text-[13px] text-muted-foreground">No {noun}s.</p>
      ) : shown.length === 0 ? (
        <p className="m-0 text-[13px] text-muted-foreground">
          No {filter} {noun}s.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {shown.map((cr) => (
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
          <Badge tone={cr.draft ? 'neutral' : STATE_TONE[cr.state]}>
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
          {checks && checks.state !== 'none' ? <span>{CHECK_LABEL[checks.state]}</span> : null}
          {cr.labels.map((l) => (
            <Badge key={l}>{l}</Badge>
          ))}
        </div>
      </div>
      <Button
        aria-label={`Open ${short} #${cr.number} in browser`}
        onClick={() => void onOpen(cr.webUrl)}
      >
        Open in browser
      </Button>
    </li>
  )
}
