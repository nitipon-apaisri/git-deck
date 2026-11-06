import type { ReactNode } from 'react'
import type { Account, LocalInfo, Repo, RepoSummary } from '@shared/types'
import {
  aheadBehindText,
  branchCountText,
  branchText,
  countText,
  dirtyText,
  isoDateText,
  sizeText,
  unixDateText,
  visibilityLabel
} from '../../lib/repoView'
import { CopyButton, ErrorBanner, RefBadge, Skeleton, Spinner } from '../ui'

interface InfoTabProps {
  repo: Repo
  account: Account | null
  summary: RepoSummary | null
  linkedPath: string | undefined
  local: {
    info: LocalInfo | null
    loading: boolean
    error: string | null
    reload: () => void
  }
}

const HEADING = 'm-0 flex items-center gap-2 text-[15px] leading-[22px] font-semibold'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-[34px] grid-cols-[minmax(110px,160px)_minmax(0,1fr)] items-center gap-3 border-b border-border last:border-b-0">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="m-0 flex min-w-0 flex-wrap items-center gap-2 [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  )
}

/** A value in the mono face with a copy button beside it. */
function Copyable({ text, what }: { text: string; what: string }) {
  if (!text) return <>—</>
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="hash [overflow-wrap:anywhere]">{text}</span>
      <CopyButton text={text} what={what} />
    </span>
  )
}

export function InfoTab({ repo, account, summary, linkedPath, local }: InfoTabProps) {
  const info = local.info
  return (
    <div className="flex flex-col gap-6">
      {repo.accountId === 'local' ? null : (
        <section className="flex flex-col gap-2" aria-label="Remote">
          <h2 className={HEADING}>Remote</h2>
          <dl className="m-0 flex flex-col">
            <Row label="Repository">{repo.fullName}</Row>
            <Row label="Host">{account ? account.host : '—'}</Row>
            <Row label="Visibility">{visibilityLabel(repo.visibility)}</Row>
            <Row label="Default branch">
              {repo.defaultBranch ? <span className="hash">{repo.defaultBranch}</span> : '—'}
            </Row>
            <Row label="Created">{isoDateText(summary?.createdAt ?? null)}</Row>
            <Row label="Last activity">
              {isoDateText(summary?.lastActivityAt ?? repo.updatedAt ?? null)}
            </Row>
            <Row label="License">{summary?.license ?? '—'}</Row>
            <Row label="Size">{sizeText(summary?.sizeKb ?? null)}</Row>
            <Row label="Web URL">
              <Copyable text={repo.webUrl} what="web URL" />
            </Row>
            <Row label="HTTPS clone URL">
              <Copyable text={repo.httpUrl} what="HTTPS clone URL" />
            </Row>
            <Row label="SSH clone URL">
              <Copyable text={repo.sshUrl} what="SSH clone URL" />
            </Row>
          </dl>
        </section>
      )}

      <section className="flex flex-col gap-2" aria-label="Local clone">
        <h2 className={HEADING}>
          {repo.accountId === 'local' ? 'Folder' : 'Local clone'}{' '}
          {local.loading && info ? <Spinner label="Reading the folder" /> : null}
        </h2>
        {!linkedPath ? (
          <p className="m-0 text-muted-foreground">
            Not cloned on this computer. Use Clone or Link existing folder above.
          </p>
        ) : local.error && !info ? (
          <ErrorBanner onRetry={local.reload} retrying={local.loading}>
            Could not read the folder: {local.error}
          </ErrorBanner>
        ) : info ? (
          <>
            {local.error ? (
              <ErrorBanner onRetry={local.reload} retrying={local.loading}>
                Could not refresh: {local.error}
              </ErrorBanner>
            ) : null}
            <dl className="m-0 flex flex-col">
              <Row label="Path">
                <Copyable text={info.path} what="folder path" />
              </Row>
              <Row label="Branch">
                <span className={info.detached ? undefined : 'hash'}>{branchText(info)}</span>
              </Row>
              <Row label="Remotes">
                {info.remotes.length > 0 ? (
                  <ul className="m-0 flex list-none flex-col gap-1 px-0 py-1.5 [&_li]:flex [&_li]:flex-wrap [&_li]:gap-2">
                    {info.remotes.map((r) => (
                      <li key={r.name}>
                        <span className="font-medium">{r.name}</span>
                        <span className="hash [overflow-wrap:anywhere]">{r.url}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  'None'
                )}
              </Row>
              <Row label="Branches">{branchCountText(info.localBranches, info.remoteBranches)}</Row>
              <Row label="Tags">
                {countText(info.tags)}
                {info.latestTags.length > 0 ? (
                  <span className="inline-flex flex-wrap gap-1.5">
                    {info.latestTags.map((t) => (
                      <RefBadge key={t} kind="tag" name={t} />
                    ))}
                  </span>
                ) : null}
              </Row>
              <Row label="Commits">{countText(info.commitCount)}</Row>
              <Row label="First commit">{unixDateText(info.firstCommitAt)}</Row>
              <Row label="Last commit">{unixDateText(info.lastCommitAt)}</Row>
              <Row label="Working tree">{dirtyText(info.dirtyFiles)}</Row>
              <Row label="Ahead / behind">{aheadBehindText(info.ahead, info.behind)}</Row>
              <Row label=".git size">{sizeText(info.sizeKb)}</Row>
            </dl>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <Skeleton label="Reading the folder" width="40%" />
            <Skeleton width="70%" />
            <Skeleton width="55%" />
            <Skeleton width="65%" />
          </div>
        )}
      </section>
    </div>
  )
}
