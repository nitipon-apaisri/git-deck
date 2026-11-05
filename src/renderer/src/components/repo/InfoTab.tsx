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
import { CopyButton, RefBadge, Spinner } from '../ui'
import styles from './InfoTab.module.css'

interface InfoTabProps {
  repo: Repo
  account: Account | null
  summary: RepoSummary | null
  linkedPath: string | undefined
  local: { info: LocalInfo | null; loading: boolean; error: string | null }
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <dt className={styles.term}>{label}</dt>
      <dd className={styles.value}>{children}</dd>
    </div>
  )
}

/** A value in the mono face with a copy button beside it. */
function Copyable({ text, what }: { text: string; what: string }) {
  if (!text) return <>—</>
  return (
    <span className={styles.copyable}>
      <span className={`${styles.mono} hash`}>{text}</span>
      <CopyButton text={text} what={what} />
    </span>
  )
}

export function InfoTab({ repo, account, summary, linkedPath, local }: InfoTabProps) {
  const info = local.info
  return (
    <div className={styles.info}>
      <section className={styles.section} aria-label="Remote">
        <h2 className={styles.heading}>Remote</h2>
        <dl className={styles.list}>
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

      <section className={styles.section} aria-label="Local clone">
        <h2 className={styles.heading}>
          Local clone {local.loading ? <Spinner label="Reading the folder" /> : null}
        </h2>
        {!linkedPath ? (
          <p className={styles.muted}>
            Not cloned on this computer. Use Clone or Link existing folder above.
          </p>
        ) : local.error && !info ? (
          <p className={styles.muted} role="alert">
            Could not read the folder: {local.error}
          </p>
        ) : info ? (
          <>
            {local.error ? (
              <p className={styles.muted} role="alert">
                Could not refresh: {local.error}
              </p>
            ) : null}
            <dl className={styles.list}>
              <Row label="Path">
                <Copyable text={info.path} what="folder path" />
              </Row>
              <Row label="Branch">
                <span className={info.detached ? undefined : 'hash'}>{branchText(info)}</span>
              </Row>
              <Row label="Remotes">
                {info.remotes.length > 0 ? (
                  <ul className={styles.remotes}>
                    {info.remotes.map((r) => (
                      <li key={r.name}>
                        <span className={styles.remoteName}>{r.name}</span>
                        <span className={`${styles.mono} hash`}>{r.url}</span>
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
                  <span className={styles.tags}>
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
          <p className={styles.muted}>Reading the folder…</p>
        )}
      </section>
    </div>
  )
}
