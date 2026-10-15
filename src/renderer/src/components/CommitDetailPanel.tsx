import { useEffect, useState } from 'react'
import type { CommitDetail, GraphCommit } from '@shared/types'
import { errorMessage } from '../lib/errors'
import { formatCount } from '../lib/format'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { RefBadges } from './RefBadges'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function CommitDetailPanel({ path, commit, onClose }: { path: string; commit: GraphCommit; onClose: () => void }): React.JSX.Element {
  const [detail, setDetail] = useState<CommitDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    setDetail(null)
    setError(null)
    window.api.local
      .commit(path, commit.hash)
      .then((d) => live && setDetail(d))
      .catch((e) => live && setError(errorMessage(e)))
    return () => {
      live = false
    }
  }, [path, commit.hash, attempt])

  return (
    <aside className="commit-panel">
      <div className="commit-panel-head">
        <strong className="ellipsis">{commit.subject}</strong>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details">
          <Icon name="x" />
        </Button>
      </div>
      <div className="commit-meta">
        <div className="copy-row">
          <code className="ellipsis">{commit.hash}</code>
          <Button variant="ghost" size="icon"
 
 aria-label="Copy hash"
 onClick={() =>
              void navigator.clipboard.writeText(commit.hash).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1200)
              })
            }
          >
            <Icon name={copied ? 'check' : 'copy'} size={14} />
          </Button>
        </div>
        <div className="author-line">
          <Avatar name={commit.author} size={20} />
          <span>{commit.author}</span>
          <span className="muted ellipsis">&lt;{commit.email}&gt;</span>
        </div>
        <div className="muted">{new Date(commit.date * 1000).toLocaleString()}</div>
        <RefBadges refs={commit.refs} />
      </div>

      {error ? (
        <div className="banner banner-error inline-banner">
          <Icon name="alert" /> <span>{error}</span>
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
        </div>
      ) : !detail ? (
        <Skeleton className="h-[120px]" />
      ) : (
        <>
          {detail.body && <pre className="commit-body">{detail.body}</pre>}
          <h4 className="files-title">
            {detail.files.length} changed file{detail.files.length === 1 ? '' : 's'}
          </h4>
          <ul className="files">
            {detail.files.map((f) => (
              <li key={f.path}>
                <span className="ellipsis" title={f.path}>{f.path}</span>
                {f.additions == null ? (
                  <span className="muted">binary</span>
                ) : (
                  <span className="numstat">
                    <span className="add">+{formatCount(f.additions)}</span> <span className="del">−{formatCount(f.deletions)}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  )
}
