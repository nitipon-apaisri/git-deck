import { useEffect, useState } from 'react'
import type { FileBlame, FileHistoryEntry } from '@shared/types'
import { errorMessage } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import { useNow } from '../../state/useNow'
import { Button, ErrorBanner, IconButton, Skeleton } from '../ui'

export interface FileRequest {
  path: string
  /** Commit the file was opened from, `null` for the work tree. Blame starts there. */
  rev: string | null
}

interface Props {
  /** Local folder of the repository. */
  repoPath: string
  file: FileRequest
  /** Show a commit in the graph. */
  onOpenCommit: (hash: string) => void
  onClose: () => void
}

type View = 'history' | 'blame'

/** History (default) and blame of one file. It reads through its own pane's folder only. */
export function FileTab({ repoPath, file, onOpenCommit, onClose }: Props) {
  const [view, setView] = useState<View>('history')
  const now = useNow()
  return (
    <section className="flex min-h-0 flex-col gap-2" aria-label={`History of ${file.path}`}>
      <div className="flex items-center gap-2">
        <h3
          className="hash m-0 min-w-0 flex-1 truncate text-[13px] font-semibold"
          title={file.path}
        >
          {file.path}
        </h3>
        <Button
          variant={view === 'history' ? 'primary' : 'default'}
          aria-pressed={view === 'history'}
          onClick={() => setView('history')}
        >
          History
        </Button>
        <Button
          variant={view === 'blame' ? 'primary' : 'default'}
          aria-pressed={view === 'blame'}
          onClick={() => setView('blame')}
        >
          Blame
        </Button>
        <IconButton label="Close file" icon="x" onClick={onClose} />
      </div>
      {view === 'history' ? (
        <History repoPath={repoPath} path={file.path} now={now} onOpenCommit={onOpenCommit} />
      ) : (
        <Blame repoPath={repoPath} file={file} now={now} onOpenCommit={onOpenCommit} />
      )}
    </section>
  )
}

function History({
  repoPath,
  path,
  now,
  onOpenCommit
}: {
  repoPath: string
  path: string
  now: number
  onOpenCommit: (hash: string) => void
}) {
  const [entries, setEntries] = useState<FileHistoryEntry[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    window.api.local
      .fileHistory(repoPath, path, page)
      .then((res) => {
        if (cancelled) return
        setEntries((prev) => (page === 0 ? res.entries : [...prev, ...res.entries]))
        setHasMore(res.hasMore)
        setError(null)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(errorMessage(err))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [repoPath, path, page, retry])

  function again(next: () => void): void {
    setLoading(true)
    next()
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <ErrorBanner onRetry={() => again(() => setRetry((n) => n + 1))} retrying={loading}>
          Could not read the history: {error}
        </ErrorBanner>
      ) : null}
      {loading && entries.length === 0 ? (
        <Skeleton label="Loading the history" width="70%" />
      ) : null}
      {!loading && !error && entries.length === 0 ? (
        <p className="m-0 text-muted-foreground">No commits touch this file.</p>
      ) : null}
      <ul className="m-0 flex list-none flex-col p-0">
        {entries.map((e) => (
          <li key={e.hash} className="border-b border-border last:border-b-0">
            <button
              type="button"
              className="flex min-h-8 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-1 text-left text-[13px] hover:bg-accent"
              title={e.path === path ? 'Show this commit in the graph' : `Was ${e.path} then`}
              onClick={() => onOpenCommit(e.hash)}
            >
              <span className="hash flex-none font-mono text-[12px] text-muted-foreground">
                {e.hash.slice(0, 7)}
              </span>
              <span className="min-w-0 flex-1 truncate">{e.subject}</span>
              {e.path !== path ? (
                <span className="hash flex-none truncate font-mono text-[12px] text-muted-foreground">
                  {e.path}
                </span>
              ) : null}
              <span className="flex-none text-[12px] text-muted-foreground">{e.author}</span>
              <span className="w-20 flex-none text-right text-[12px] text-muted-foreground">
                {timeAgo(e.date * 1000, now)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <div>
          <Button disabled={loading} onClick={() => again(() => setPage((p) => p + 1))}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function Blame({
  repoPath,
  file,
  now,
  onOpenCommit
}: {
  repoPath: string
  file: FileRequest
  now: number
  onOpenCommit: (hash: string) => void
}) {
  const [result, setResult] = useState<FileBlame | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    window.api.local
      .blame(repoPath, file.path, file.rev)
      .then((res) => {
        if (!cancelled) setResult(res)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [repoPath, file.path, file.rev, retry])

  if (error) {
    return (
      <ErrorBanner
        onRetry={() => {
          setError(null)
          setRetry((n) => n + 1)
        }}
      >
        Could not blame this file: {error}
      </ErrorBanner>
    )
  }
  if (!result) return <Skeleton label="Loading the blame" width="70%" />
  if (result.binary)
    return <p className="m-0 text-muted-foreground">Binary file: no lines to blame.</p>

  return (
    <div className="overflow-auto rounded-lg bg-secondary py-1 font-mono text-[12px]">
      {result.lines.map((l, i) => {
        // Show the commit once for a run of lines from the same commit.
        const first = i === 0 || result.lines[i - 1].hash !== l.hash
        return (
          <div key={l.line} className="flex min-h-5 items-baseline gap-3 px-2">
            <button
              type="button"
              disabled={l.uncommitted}
              className="flex w-56 flex-none cursor-pointer items-baseline gap-2 border-0 bg-transparent p-0 text-left text-muted-foreground enabled:hover:text-foreground disabled:cursor-default"
              title={l.uncommitted ? 'Not committed yet' : 'Show this commit in the graph'}
              aria-label={`Line ${l.line}: ${l.uncommitted ? 'not committed yet' : `commit ${l.hash.slice(0, 7)} by ${l.author}`}`}
              onClick={() => onOpenCommit(l.hash)}
            >
              {first ? (
                <>
                  <span className="flex-none">
                    {l.uncommitted ? '·······' : l.hash.slice(0, 7)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {l.uncommitted ? 'Not committed yet' : l.author}
                  </span>
                  <span className="flex-none">
                    {l.uncommitted ? '' : timeAgo(l.date * 1000, now)}
                  </span>
                </>
              ) : null}
            </button>
            <span className="w-8 flex-none text-right text-muted-foreground">{l.line}</span>
            <span className="min-w-0 flex-1 whitespace-pre">{l.text}</span>
          </div>
        )
      })}
    </div>
  )
}
