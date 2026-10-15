import { useEffect, useState } from 'react'
import type { Repo } from '@shared/types'
import { errorMessage } from '../lib/errors'
import { Icon } from './Icon'

interface Props {
  repo: Repo
  linkedPath: string | null
  onLinkChange: (repoKey: string, path: string | null) => void
  onFetched: () => void
}

export function RepoHeader({ repo, linkedPath, onLinkChange, onFetched }: Props): React.JSX.Element {
  const [busy, setBusy] = useState<null | 'clone' | 'link' | 'fetch'>(null)
  const [progress, setProgress] = useState<{ line: string; percent: number | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    setProgress(null)
  }, [repo.key])

  useEffect(
    () =>
      window.api.local.onCloneProgress((p) => {
        if (p.repoKey === repo.key) setProgress((prev) => ({ line: p.line, percent: p.percent ?? prev?.percent ?? null }))
      }),
    [repo.key]
  )

  const run = async (kind: 'clone' | 'link' | 'fetch', fn: () => Promise<void>): Promise<void> => {
    setBusy(kind)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  const clone = (protocol: 'https' | 'ssh'): Promise<void> =>
    run('clone', async () => {
      const path = await window.api.local.clone(repo.key, protocol)
      if (path) onLinkChange(repo.key, path)
    })
  const link = (): Promise<void> =>
    run('link', async () => {
      const path = await window.api.local.link(repo.key)
      if (path) onLinkChange(repo.key, path)
    })
  const fetchLocal = (): Promise<void> =>
    run('fetch', async () => {
      if (!linkedPath) return
      await window.api.local.fetch(linkedPath)
      onFetched()
    })
  const unlink = (): Promise<void> =>
    run('link', async () => {
      await window.api.local.unlink(repo.key)
      onLinkChange(repo.key, null)
    })

  return (
    <header className="repo-header">
      <div className="repo-title">
        <h1 className="ellipsis">{repo.fullName}</h1>
        <span className="badge">{repo.visibility}</span>
        {repo.archived && <span className="badge">archived</span>}
        {repo.fork && <span className="badge">fork</span>}
        <span className="spacer" />
        <button className="btn" onClick={() => void window.api.openExternal(repo.webUrl)}>
          <Icon name="external" /> Open on web
        </button>
      </div>
      <p className="muted repo-desc">{repo.description || 'No description'}</p>

      <div className="actions local-actions">
        {linkedPath ? (
          <>
            <button className="btn" onClick={() => void window.api.local.reveal(linkedPath).catch((e) => setError(errorMessage(e)))}>
              Open folder
            </button>
            <button className="btn" disabled={busy !== null} onClick={() => void fetchLocal()}>
              <Icon name="refresh" /> {busy === 'fetch' ? 'Fetching…' : 'Fetch'}
            </button>
            <button className="btn" disabled={busy !== null} onClick={() => void unlink()}>
              Unlink
            </button>
            <span className="muted ellipsis" title={linkedPath}>
              {linkedPath}
            </span>
          </>
        ) : (
          <>
            <button className="btn btn-primary" disabled={busy !== null} onClick={() => void clone('https')}>
              Clone (HTTPS)
            </button>
            <button className="btn" disabled={busy !== null} onClick={() => void clone('ssh')}>
              Clone (SSH)
            </button>
            <button className="btn" disabled={busy !== null} onClick={() => void link()}>
              Link existing folder
            </button>
          </>
        )}
      </div>

      {busy === 'clone' && (
        <div className="progress-wrap">
          <div className="progress">
            <div className="progress-bar" style={{ width: `${progress?.percent ?? 0}%` }} />
          </div>
          <span className="muted ellipsis">{progress?.line ?? 'Starting clone…'}</span>
        </div>
      )}
      {error && (
        <div className="banner banner-error inline-banner">
          <Icon name="alert" /> <span>{error}</span>
        </div>
      )}
    </header>
  )
}
