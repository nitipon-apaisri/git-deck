import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useCommitDetail, useGraph } from '../../state/graphData'
import { useNow } from '../../state/useNow'
import {
  ROW_HEIGHT,
  loadedText,
  moveIndex,
  needsNextPage,
  scrollToRow,
  visibleRange,
  widestLane
} from '../../lib/graphView'
import { Button, Icon, IconButton, Spinner } from '../ui'
import { CommitDetailPanel } from './CommitDetailPanel'
import { GraphRowView } from './GraphRowView'
import styles from './GitGraph.module.css'

interface GitGraphProps {
  /** The linked folder, `null` when the repository is not cloned or linked. */
  path: string | null
  defaultBranch: string
  /** False while another tab is showing. The graph stays mounted to keep its place. */
  visible: boolean
  /** Changes after a fetch, a clone or a link: the history is read again. */
  reloadToken: number
  fetching: boolean
  onFetch: () => void
  /** A narrow pane: no author or date column, and the detail opens as a drawer. */
  narrow: boolean
}

/**
 * The commit graph of one repository. Its layout, pages, scroll position and selected
 * commit all live here, so two panes show two independent graphs.
 */
export function GitGraph({
  path,
  defaultBranch,
  visible,
  reloadToken,
  fetching,
  onFetch,
  narrow
}: GitGraphProps) {
  const idPrefix = useId()
  const now = useNow()
  const graph = useGraph(path, reloadToken)
  const { rows, loading, done, error, loadMore, reload } = graph

  const viewport = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  // The last position seen while visible: a hidden tab reports nothing useful.
  const savedTop = useRef(0)

  // The selection is a hash, not an index, so it survives a reload.
  const [selectedHash, setSelectedHash] = useState<string | null>(null)
  const selectedIndex = useMemo(
    () => (selectedHash === null ? -1 : rows.findIndex((r) => r.commit.hash === selectedHash)),
    [rows, selectedHash]
  )
  const selected = selectedIndex >= 0 ? rows[selectedIndex].commit : null
  const detail = useCommitDetail(path, selected?.hash ?? null)

  const linked = path !== null
  useEffect(() => {
    const el = viewport.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      // A zero height means the tab is hidden. Keep the last real size.
      if (el.clientHeight > 0) setViewportHeight(el.clientHeight)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [linked])

  useLayoutEffect(() => {
    const el = viewport.current
    if (visible && el) el.scrollTop = savedTop.current
  }, [visible])

  useEffect(() => {
    if (
      needsNextPage({
        scrollTop,
        viewportHeight,
        rowCount: rows.length,
        done,
        loading,
        error: error !== null
      })
    ) {
      loadMore()
    }
  }, [scrollTop, viewportHeight, rows.length, done, loading, error, loadMore])

  const range = visibleRange(scrollTop, viewportHeight, rows.length)
  const drawn = rows.slice(range.start, range.end)
  const lanes = widestLane(drawn.map((r) => r.width))

  const select = useCallback((hash: string) => setSelectedHash(hash), [])

  function onScroll(): void {
    const el = viewport.current
    if (!el) return
    if (visible && el.clientHeight > 0) savedTop.current = el.scrollTop
    setScrollTop(el.scrollTop)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape' && selectedHash !== null) {
      event.preventDefault()
      setSelectedHash(null)
      return
    }
    const pageRows = Math.max(1, Math.floor(viewportHeight / ROW_HEIGHT) - 1)
    const next = moveIndex(
      event.key,
      selectedIndex >= 0 ? selectedIndex : null,
      rows.length,
      pageRows
    )
    if (next === null) return
    event.preventDefault()
    setSelectedHash(rows[next].commit.hash)
    const el = viewport.current
    if (el) el.scrollTop = scrollToRow(next, el.scrollTop, el.clientHeight)
  }

  if (path === null) {
    return (
      <div className={styles.empty}>
        <Icon name="git-branch" />
        <p>Not cloned on this computer. Use Clone or Link existing folder above.</p>
      </div>
    )
  }

  const firstLoad = rows.length === 0 && (loading || (!done && error === null))
  const emptyRepo = rows.length === 0 && done && error === null
  const failedFirst = rows.length === 0 && error !== null

  return (
    <div
      className={styles.graph}
      data-detail={selected ? 'open' : 'closed'}
      data-narrow={narrow ? 'true' : undefined}
    >
      <div className={styles.toolbar}>
        <IconButton label="Reload graph" icon="refresh" disabled={loading} onClick={reload} />
        <Button icon="download" disabled={fetching} onClick={onFetch}>
          {fetching ? 'Fetching…' : 'Fetch'}
        </Button>
        {loading || fetching ? <Spinner label={fetching ? 'Fetching' : 'Loading commits'} /> : null}
        <span className={styles.count} aria-live="polite">
          {loadedText(rows.length, done || error !== null)}
        </span>
      </div>

      <div className={styles.body}>
        {firstLoad ? (
          <div className={styles.empty}>
            <Spinner label="Loading commits" />
            <p>Reading the history…</p>
          </div>
        ) : null}
        {emptyRepo ? (
          <div className={styles.empty}>
            <Icon name="git-branch" />
            <p>This repository has no commits yet.</p>
          </div>
        ) : null}
        {failedFirst ? (
          <div className={styles.empty} role="alert">
            <Icon name="alert" />
            <p>Could not read the history: {error}</p>
            <Button onClick={reload}>Try again</Button>
          </div>
        ) : null}

        <div className={styles.listColumn} hidden={rows.length === 0}>
          <div
            ref={viewport}
            className={styles.viewport}
            role="listbox"
            aria-label="Commits"
            aria-activedescendant={selected ? `${idPrefix}-${selected.hash}` : undefined}
            tabIndex={0}
            onScroll={onScroll}
            onKeyDown={onKeyDown}
          >
            <div className={styles.spacer} style={{ height: rows.length * ROW_HEIGHT }}>
              {drawn.map((row, i) => (
                <GraphRowView
                  key={row.commit.hash}
                  id={`${idPrefix}-${row.commit.hash}`}
                  row={row}
                  index={range.start + i}
                  total={rows.length}
                  lanes={lanes}
                  now={now}
                  defaultBranch={defaultBranch}
                  compact={narrow}
                  selected={row.commit.hash === selectedHash}
                  onSelect={select}
                />
              ))}
            </div>
          </div>
          {error !== null && rows.length > 0 ? (
            <p className={styles.notice} role="alert">
              <Icon name="alert" size="sm" />
              <span>Could not load more commits: {error}</span>
              <Button onClick={loadMore}>Try again</Button>
            </p>
          ) : null}
        </div>

        {selected ? (
          <CommitDetailPanel
            key={selected.hash}
            commit={selected}
            state={detail}
            defaultBranch={defaultBranch}
            onClose={() => setSelectedHash(null)}
          />
        ) : null}
      </div>
    </div>
  )
}
