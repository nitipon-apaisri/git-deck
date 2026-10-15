import { useEffect, useState } from 'react'
import type { LocalInfo, Repo, RepoSummary } from '@shared/types'
import { errorMessage } from '../lib/errors'
import { formatCount, formatDate, formatSize } from '../lib/format'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="kv">
      <dt className="muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Copy({ text }: { text: string }): React.JSX.Element {
  const [done, setDone] = useState(false)
  return (
    <span className="copy-row">
      <code className="ellipsis">{text}</code>
      <Button variant="ghost" size="icon"
 
 aria-label="Copy"
 onClick={() => {
          void navigator.clipboard.writeText(text).then(() => {
            setDone(true)
            setTimeout(() => setDone(false), 1200)
          })
        }}
      >
        <Icon name={done ? 'check' : 'copy'} size={14} />
      </Button>
    </span>
  )
}

interface Props {
  repo: Repo
  host: string
  summary: RepoSummary | null
  linkedPath: string | null
  reloadToken: number
}

export function Info({ repo, host, summary, linkedPath, reloadToken }: Props): React.JSX.Element {
  const [local, setLocal] = useState<LocalInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    setLocal(null)
    setError(null)
    if (linkedPath) {
      window.api.local
        .info(linkedPath)
        .then((i) => live && setLocal(i))
        .catch((e) => live && setError(errorMessage(e)))
    }
    return () => {
      live = false
    }
  }, [linkedPath, reloadToken, attempt])

  const ts = (v: number | null): string => (v == null ? '—' : formatDate(v))

  return (
    <div className="info">
      <section>
        <h3>Remote</h3>
        <dl>
          <Row label="Full name">{repo.fullName}</Row>
          <Row label="Host">{host}</Row>
          <Row label="Visibility">{repo.visibility}</Row>
          <Row label="Default branch">{repo.defaultBranch || '—'}</Row>
          <Row label="Created">{formatDate(summary?.createdAt)}</Row>
          <Row label="Last activity">{formatDate(summary?.lastActivityAt ?? repo.updatedAt)}</Row>
          <Row label="License">{summary?.license ?? '—'}</Row>
          <Row label="Size">{formatSize(summary?.sizeKb)}</Row>
          <Row label="Web URL">
            <Copy text={repo.webUrl} />
          </Row>
          <Row label="HTTPS clone">
            <Copy text={repo.httpUrl} />
          </Row>
          <Row label="SSH clone">
            <Copy text={repo.sshUrl} />
          </Row>
        </dl>
      </section>

      <section>
        <h3>Local</h3>
        {!linkedPath ? (
          <p className="muted">Not linked to a local clone. Use Clone or Link above.</p>
        ) : error ? (
          <div className="banner banner-error inline-banner">
            <Icon name="alert" /> <span>{error}</span>
            <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
          </div>
        ) : !local ? (
          <Skeleton className="h-[120px]" />
        ) : (
          <dl>
            <Row label="Path">{local.path}</Row>
            <Row label="Branch">{local.detached ? `Detached HEAD${local.headHash ? ` at ${local.headHash.slice(0, 7)}` : ''}` : (local.currentBranch ?? '—')}</Row>
            <Row label="Remotes">
              {local.remotes.length === 0 ? '—' : local.remotes.map((r) => <div key={r.name}>{r.name} <span className="muted">{r.url}</span></div>)}
            </Row>
            <Row label="Branches">{formatCount(local.localBranches)} local, {formatCount(local.remoteBranches)} remote</Row>
            <Row label="Tags">
              {formatCount(local.tags)}
              {local.latestTags.length > 0 && <span className="muted"> (latest: {local.latestTags.join(', ')})</span>}
            </Row>
            <Row label="Commits">{formatCount(local.commitCount)}</Row>
            <Row label="First commit">{ts(local.firstCommitAt)}</Row>
            <Row label="Last commit">{ts(local.lastCommitAt)}</Row>
            <Row label="Uncommitted files">{formatCount(local.dirtyFiles)}</Row>
            <Row label="Ahead / behind">{formatCount(local.ahead)} / {formatCount(local.behind)}</Row>
            <Row label=".git size">{formatSize(local.sizeKb)}</Row>
          </dl>
        )}
      </section>
    </div>
  )
}
