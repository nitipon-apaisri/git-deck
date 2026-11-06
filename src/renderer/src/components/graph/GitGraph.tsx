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
import { cn } from '@/lib/cn'
import type { CheckoutTarget, GraphCommit } from '@shared/types'
import { refActions, type RefAction } from '../../lib/branchView'
import type { BadgeView } from '../../lib/graphView'
import { Button, Dialog, Icon, IconButton, Menu, Spinner, type MenuEntry } from '../ui'
import { useDiff } from '../../state/changesData'
import { DiffView } from '../repo/DiffView'
import { CommitDetailPanel } from './CommitDetailPanel'
import { GraphRowView } from './GraphRowView'

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
  /** Which pane this is. A swap changes it, and the scroll position is put back. */
  place: 1 | 2
  /** What a right-click may do. Absent: no menu (nothing is writable). */
  menuOps?: GraphMenuOps
}

export interface GraphMenuOps {
  /** A write is already running, so the entries are off. */
  busy: boolean
  checkout: (target: CheckoutTarget) => void
  deleteBranch: (name: string) => void
  createBranch: (startPoint: string, startLabel: string) => void
  renameBranch: (name: string) => void
}

/**
 * The commit graph of one repository. Its layout, pages, scroll position and selected
 * commit all live here, so two panes show two independent graphs.
 */
const EMPTY =
  'col-span-full flex min-h-40 flex-col items-center justify-center gap-2 text-center text-muted-foreground [&_p]:m-0 [&_p]:max-w-[48ch] [&_p]:[overflow-wrap:anywhere]'

export function GitGraph({
  path,
  defaultBranch,
  visible,
  reloadToken,
  fetching,
  onFetch,
  narrow,
  place,
  menuOps
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
  // The file whose diff is open, for the selected commit only.
  const [diffFile, setDiffFile] = useState<{ hash: string; path: string } | null>(null)
  const openDiff = diffFile && diffFile.hash === selected?.hash ? diffFile : null
  const diff = useDiff(
    path,
    openDiff ? { source: 'commit', hash: openDiff.hash, path: openDiff.path } : null
  )

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

  // The browser resets a scroll position when the element is detached, which is what a
  // tab change (display: none) and a pane swap (the DOM node moves) both do.
  useLayoutEffect(() => {
    const el = viewport.current
    if (visible && el) el.scrollTop = savedTop.current
  }, [visible, place])

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

  const [menu, setMenu] = useState<{
    x: number
    y: number
    commit: GraphCommit
    ref: BadgeView | null
  } | null>(null)
  const openMenu = (commit: GraphCommit, at: { x: number; y: number }, ref: BadgeView | null) =>
    setMenu({ ...at, commit, ref })

  function runAction(action: RefAction, commit: GraphCommit): void {
    if (!menuOps) return
    switch (action.type) {
      case 'checkout-branch':
        return menuOps.checkout({ kind: 'branch', name: action.name })
      case 'checkout-remote':
        return menuOps.checkout({ kind: 'remote', name: action.name })
      case 'checkout-commit':
        return menuOps.checkout({ kind: 'commit', hash: action.hash })
      case 'create-branch':
        return menuOps.createBranch(action.startPoint, commit.hash.slice(0, 7))
      case 'rename-branch':
        return menuOps.renameBranch(action.name)
      case 'delete-branch':
        return menuOps.deleteBranch(action.name)
      case 'copy':
        void navigator.clipboard?.writeText(action.text).catch(() => {})
    }
  }

  function menuEntries(commit: GraphCommit, ref: BadgeView | null): MenuEntry[] {
    const items = refActions(
      ref ? { kind: ref.refKind, name: ref.name, current: ref.current } : null,
      commit.hash
    )
    const entries: MenuEntry[] = []
    items.forEach((item, i) => {
      if (i > 0 && items[i - 1].group !== item.group) {
        entries.push({ kind: 'separator', id: `sep-${item.id}` })
      }
      entries.push({
        kind: 'item',
        id: item.id,
        label: item.label,
        danger: item.danger,
        // Copying works while a write runs; everything else waits for it.
        disabled: !!menuOps?.busy && item.action.type !== 'copy',
        onSelect: () => runAction(item.action, commit)
      })
    })
    return entries
  }

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
      <div className={EMPTY}>
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
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-2"
      data-detail={selected ? 'open' : 'closed'}
      data-narrow={narrow ? 'true' : undefined}
    >
      <div className="flex flex-none items-center gap-2">
        <IconButton label="Reload graph" icon="refresh" disabled={loading} onClick={reload} />
        <Button icon="download" disabled={fetching} onClick={onFetch}>
          {fetching ? 'Fetching…' : 'Fetch'}
        </Button>
        {loading || fetching ? <Spinner label={fetching ? 'Fetching' : 'Loading commits'} /> : null}
        <span
          className="ml-auto text-[12px] whitespace-nowrap text-muted-foreground"
          aria-live="polite"
        >
          {loadedText(rows.length, done || error !== null)}
        </span>
      </div>

      <div
        className={cn(
          'relative grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-3',
          selected && !narrow && 'grid-cols-[minmax(0,1fr)_minmax(280px,360px)]',
          // A narrow pane: the detail covers the list as a drawer instead of squeezing it.
          selected &&
            narrow &&
            '[&>aside]:absolute [&>aside]:inset-[0_0_0_auto] [&>aside]:z-[1] [&>aside]:w-[min(360px,100%)] [&>aside]:shadow-[var(--shadow-menu)]'
        )}
      >
        {firstLoad ? (
          <div className={EMPTY}>
            <Spinner label="Loading commits" />
            <p>Reading the history…</p>
          </div>
        ) : null}
        {emptyRepo ? (
          <div className={EMPTY}>
            <Icon name="git-branch" />
            <p>This repository has no commits yet.</p>
          </div>
        ) : null}
        {failedFirst ? (
          <div className={EMPTY} role="alert">
            <Icon name="alert" />
            <p>Could not read the history: {error}</p>
            <Button onClick={reload}>Try again</Button>
          </div>
        ) : null}

        <div
          className="flex min-h-0 min-w-0 flex-col gap-2 [&[hidden]]:hidden"
          hidden={rows.length === 0}
        >
          <div
            ref={viewport}
            className="min-h-0 flex-1 overflow-auto rounded-md -outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
            role="listbox"
            aria-label="Commits"
            aria-activedescendant={selected ? `${idPrefix}-${selected.hash}` : undefined}
            tabIndex={0}
            onScroll={onScroll}
            onKeyDown={onKeyDown}
          >
            <div className="relative" style={{ height: rows.length * ROW_HEIGHT }}>
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
                  onMenu={menuOps ? openMenu : undefined}
                />
              ))}
            </div>
          </div>
          {error !== null && rows.length > 0 ? (
            <p
              className="m-0 flex flex-none items-center gap-2 rounded-md bg-[var(--warning-bg)] px-3 py-2 text-[var(--warning-text)] [&_span]:min-w-0 [&_span]:flex-1 [&_span]:[overflow-wrap:anywhere]"
              role="alert"
            >
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
            onOpenFile={(file) => setDiffFile({ hash: selected.hash, path: file })}
          />
        ) : null}
        {menu && menuOps ? (
          <Menu
            label="Commit actions"
            at={{ x: menu.x, y: menu.y }}
            entries={menuEntries(menu.commit, menu.ref)}
            onClose={() => setMenu(null)}
          />
        ) : null}
        {openDiff ? (
          <Dialog
            title={`Changes in commit ${openDiff.hash.slice(0, 7)}`}
            width={960}
            onClose={() => setDiffFile(null)}
          >
            <DiffView path={openDiff.path} state={diff} />
          </Dialog>
        ) : null}
      </div>
    </div>
  )
}
