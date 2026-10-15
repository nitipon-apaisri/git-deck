import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { GraphLayout, type GraphRow } from '@shared/graph-layout'
import { errorMessage } from '../lib/errors'
import { formatDate, timeAgo } from '../lib/format'
import { Avatar } from './Avatar'
import { CommitDetailPanel } from './CommitDetailPanel'
import { LANE_WIDTH, ROW_HEIGHT, GraphRowSvg } from './GraphRowSvg'
import { Icon } from './Icon'
import { RefBadges } from './RefBadges'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const PAGE = 500
const OVERSCAN = 10
const LOAD_AHEAD = 20

interface Props {
  path: string | null
  reloadToken: number
  onFetched: () => void
}

export function GitGraph({ path, reloadToken, onFetched }: Props): React.JSX.Element {
  const [rows, setRows] = useState<GraphRow[]>([])
  const [lanes, setLanes] = useState(1)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [fetching, setFetching] = useState(false)
  const [reloads, setReloads] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(600)

  const scroller = useRef<HTMLDivElement | null>(null)
  const layout = useRef(new GraphLayout())
  const generation = useRef(0)
  const state = useRef({ loaded: 0, loading: false, done: false })

  const loadPage = useCallback(async (): Promise<void> => {
    if (!path || state.current.loading || state.current.done) return
    const gen = generation.current
    state.current.loading = true
    setLoading(true)
    try {
      const page = await window.api.local.graph(path, state.current.loaded, PAGE)
      if (gen !== generation.current) return
      const added = layout.current.addAll(page)
      state.current.loaded += page.length
      if (page.length < PAGE) {
        state.current.done = true
        setDone(true)
      }
      setRows((prev) => [...prev, ...added])
      setLanes(layout.current.maxLanes)
      setError(null)
    } catch (e) {
      if (gen === generation.current) setError(errorMessage(e))
    } finally {
      if (gen === generation.current) {
        state.current.loading = false
        setLoading(false)
      }
    }
  }, [path])

  // A path change, reload or fetch starts over; the generation counter drops stale pages.
  useEffect(() => {
    generation.current++
    layout.current = new GraphLayout()
    state.current = { loaded: 0, loading: false, done: false }
    setRows([])
    setLanes(1)
    setDone(false)
    setError(null)
    setSelected(null)
    setLoading(false)
    if (scroller.current) scroller.current.scrollTop = 0
    void loadPage()
  }, [loadPage, reloadToken, reloads])

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    setViewport(el.clientHeight)
    const ro = new ResizeObserver(() => setViewport(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [path])

  // Next page when near the end, or when the content is shorter than the viewport.
  useEffect(() => {
    if (done || loading || error || rows.length === 0) return
    const nearEnd = scrollTop + viewport >= (rows.length - LOAD_AHEAD) * ROW_HEIGHT
    if (nearEnd) void loadPage()
  }, [rows.length, scrollTop, viewport, done, loading, error, loadPage])

  const select = (i: number): void => {
    const next = Math.max(0, Math.min(rows.length - 1, i))
    setSelected(next)
    const el = scroller.current
    if (!el) return
    const top = next * ROW_HEIGHT
    if (top < el.scrollTop) el.scrollTop = top
    else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_HEIGHT - el.clientHeight
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (rows.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      select(selected == null ? 0 : selected + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      select(selected == null ? 0 : selected - 1)
    } else if (e.key === 'Escape') setSelected(null)
  }

  const doFetch = async (): Promise<void> => {
    if (!path) return
    setFetching(true)
    try {
      await window.api.local.fetch(path)
      onFetched()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setFetching(false)
    }
  }

  if (!path) {
    return <div className="graph-empty muted">This repository is not linked to a local folder. Use Clone or Link above.</div>
  }

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const last = Math.min(rows.length, Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + OVERSCAN)
  const graphWidth = Math.max(1, lanes) * LANE_WIDTH
  const selectedCommit = selected != null ? rows[selected]?.commit : undefined

  return (
    <div className="git-graph">
      <div className="graph-toolbar">
        <Button variant="outline" onClick={() => setReloads((n) => n + 1)} disabled={loading}>
          <Icon name="refresh" /> Reload
        </Button>
        <Button variant="outline" onClick={() => void doFetch()} disabled={fetching}>
          {fetching ? 'Fetching…' : 'Fetch'}
        </Button>
        <span className="muted">
          {rows.length.toLocaleString()} commit{rows.length === 1 ? '' : 's'} loaded{loading ? '…' : done ? '' : '+'}
        </span>
      </div>

      {error && (
        <div className="banner banner-error inline-banner">
          <Icon name="alert" /> <span>{error}</span>
          <Button variant="outline" onClick={() => (rows.length === 0 ? setReloads((n) => n + 1) : void loadPage())}>Retry</Button>
        </div>
      )}

      <div className="graph-body">
        <div
          className="graph-list"
          ref={scroller}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
          {rows.length === 0 && done && !error && <div className="graph-empty muted">This repository has no commits yet.</div>}
          {rows.length === 0 && loading && <Skeleton className="graph-" />}
          <div style={{ height: rows.length * ROW_HEIGHT, position: 'relative' }}>
            {rows.slice(first, last).map((row, k) => {
              const i = first + k
              const c = row.commit
              return (
                <div
                  key={c.hash}
                  className={`graph-row${i === selected ? ' selected' : ''}`}
                  style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                  onClick={() => select(i)}
                >
                  <div className="graph-cell" style={{ width: graphWidth }}>
                    <GraphRowSvg row={row} lanes={lanes} />
                  </div>
                  <div className="graph-subject">
                    <RefBadges refs={c.refs} />
                    <span className="ellipsis">{c.subject}</span>
                  </div>
                  <div className="graph-author">
                    <Avatar name={c.author} size={16} />
                    <span className="ellipsis">{c.author}</span>
                  </div>
                  <div className="graph-date muted" title={`${formatDate(c.date)} ${new Date(c.date * 1000).toLocaleTimeString()}`}>
                    {timeAgo(c.date)}
                  </div>
                  <code className="graph-hash muted">{c.hash.slice(0, 7)}</code>
                </div>
              )
            })}
          </div>
        </div>
        {selectedCommit && <CommitDetailPanel path={path} commit={selectedCommit} onClose={() => setSelected(null)} />}
      </div>
    </div>
  )
}
