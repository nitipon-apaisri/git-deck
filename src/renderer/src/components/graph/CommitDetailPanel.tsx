import { useState } from 'react'
import type { GraphCommit } from '@shared/types'
import type { CommitDetailState } from '../../state/graphData'
import {
  FILE_LIMIT,
  additionsText,
  authorLabel,
  badgeViews,
  bodyText,
  commitDateTitle,
  deletionsText,
  fileTotals,
  fileTotalsText
} from '../../lib/graphView'
import { Avatar, Button, CopyButton, ErrorBanner, IconButton, RefBadge, Skeleton } from '../ui'

interface CommitDetailPanelProps {
  commit: GraphCommit
  state: CommitDetailState
  defaultBranch: string
  onClose: () => void
}

const FIELD =
  'flex min-w-0 flex-col gap-0.5 [&_dt]:text-[12px] [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:[overflow-wrap:anywhere]'

export function CommitDetailPanel({
  commit,
  state,
  defaultBranch,
  onClose
}: CommitDetailPanelProps) {
  const [showAll, setShowAll] = useState(false)
  const author = authorLabel(commit.author, commit.email)
  const badges = badgeViews(commit.refs, defaultBranch)
  const { detail } = state
  const body = detail ? bodyText(detail.body, commit.subject) : ''
  const files = detail?.files ?? []
  const shownFiles = showAll ? files : files.slice(0, FILE_LIMIT)

  return (
    <aside
      className="flex min-h-0 min-w-0 flex-col rounded-lg bg-secondary"
      aria-label="Commit details"
    >
      <div className="flex items-start gap-2 px-3 pt-3 pb-2">
        <h3 className="m-0 min-w-0 flex-1 text-[15px] leading-[22px] font-semibold [overflow-wrap:anywhere]">
          {commit.subject || '(no message)'}
        </h3>
        <IconButton label="Close details" icon="x" onClick={onClose} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 pb-3">
        <dl className="m-0 flex flex-col gap-2">
          <div className={FIELD}>
            <dt>Commit</dt>
            <dd className="flex items-center gap-1.5">
              <span className="hash">{commit.hash}</span>
              <CopyButton text={commit.hash} what="commit hash" />
            </dd>
          </div>
          <div className={FIELD}>
            <dt>Author</dt>
            <dd className="flex items-center gap-1.5">
              <Avatar name={author} size={24} />
              <span>
                {author}
                {commit.email ? (
                  <span className="text-muted-foreground"> &lt;{commit.email}&gt;</span>
                ) : null}
              </span>
            </dd>
          </div>
          <div className={FIELD}>
            <dt>Date</dt>
            <dd>{commitDateTitle(commit.date) || '—'}</dd>
          </div>
          {badges.length > 0 ? (
            <div className={FIELD}>
              <dt>Refs</dt>
              <dd className="flex flex-wrap gap-1">
                {badges.map((b) => (
                  <RefBadge
                    key={`${b.kind}:${b.name}`}
                    kind={b.kind}
                    name={b.name}
                    current={b.current}
                    maxLength={40}
                  />
                ))}
              </dd>
            </div>
          ) : null}
        </dl>

        {state.loading && !detail ? (
          <div className="flex flex-col gap-3">
            <Skeleton label="Loading the commit" width="45%" />
            <Skeleton width="85%" />
            <Skeleton width="70%" />
            <Skeleton width="78%" />
          </div>
        ) : null}
        {state.error ? (
          <ErrorBanner onRetry={state.reload} retrying={state.loading}>
            Could not read this commit: {state.error}
          </ErrorBanner>
        ) : null}

        {body ? (
          <pre className="m-0 [font:inherit] whitespace-pre-wrap [overflow-wrap:anywhere]">
            {body}
          </pre>
        ) : null}

        {detail ? (
          <section className="flex flex-col gap-2" aria-label="Changed files">
            <h4 className="m-0 text-[12px] leading-[18px] font-semibold text-muted-foreground">
              {fileTotalsText(fileTotals(files))}
            </h4>
            <ul className="m-0 flex list-none flex-col p-0">
              {shownFiles.map((f) => (
                <li
                  key={f.path}
                  className="flex min-h-[26px] items-center gap-2 border-b border-border text-[12px] last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate font-mono" title={f.path}>
                    {f.path}
                  </span>
                  <span className="flex flex-none gap-1.5 font-mono">
                    <span
                      className={
                        f.additions === null
                          ? 'text-muted-foreground'
                          : 'text-[var(--success-text)]'
                      }
                    >
                      {additionsText(f.additions)}
                    </span>
                    {f.deletions === null ? null : (
                      <span className="text-destructive">{deletionsText(f.deletions)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {files.length > shownFiles.length ? (
              <Button variant="ghost" onClick={() => setShowAll(true)}>
                Show all {files.length.toLocaleString('en-GB')} files
              </Button>
            ) : null}
          </section>
        ) : null}
      </div>
    </aside>
  )
}
