import { useEffect, useState } from 'react'
import type { CommitDetail, GraphCommit } from '@shared/types'
import { errorMessage } from '../lib/errors'
import { formatCount } from '../lib/format'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { RefBadges } from './RefBadges'

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
        <button className="icon-btn" onClick={onClose} aria-label="Close details">
          <Icon name="x" />
        </button>
      </div>
      <div className="commit-meta">
        <div className="copy-row">
          <code className="ellipsis">{commit.hash}</code>
          <button
            className="icon-btn"
            aria-label="Copy hash"
            onClick={() =>
              void navigator.clipboard.writeText(commit.hash).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1200)
              })
            }
          >
            <Icon name={copied ? 'check' : 'copy'} size={14} />
          </button>
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
          <button className="btn" onClick={() => setAttempt((n) => n + 1)}>Retry</button>
        </div>
      ) : !detail ? (
        <div className="skeleton" />
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
