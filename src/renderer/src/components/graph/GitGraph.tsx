import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useCommitDetail, useGraph } from '../../state/graphData'
import { useNow } from '../../state/useNow'
import {
  ROW_HEIGHT,
  WIP_HASH,
  moveIndex,
  needsNextPage,
  scrollToRow,
  visibleRange,
  widestLane
} from '../../lib/graphView'
import { cn } from '@/lib/cn'
import type {
  CheckoutTarget,
  DiffRequest,
  GraphCommit,
  HunkRequest,
  ResetMode
} from '@shared/types'
import { errorMessage } from '../../lib/errors'
import { canStageHunks } from '../../lib/changesView'
import { refActions, type RefAction } from '../../lib/branchView'
import { refMenuEntries } from '../../lib/refMenu'
import type { BadgeView } from '../../lib/graphView'
import { detailPlacement } from '../../lib/splitLayout'
import { Button, Dialog, ErrorBanner, Icon, Menu, Spinner, type MenuEntry } from '../ui'
import { useDiff, useStatus } from '../../state/changesData'
import { DiffView } from '../repo/DiffView'
import { ChangesPanel } from './ChangesPanel'
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
  /** Changes when files or refs change on disk: status and diff reload, the graph only if HEAD moved. */
  watchToken: number
  /** Tells the pane that the folder changed, so Info and the branches reload too. */
  onChanged: () => void
  /** A narrow pane: no author or date column. */
  narrow: boolean
  /** Split View is on: the detail opens under the graph, as in a narrow pane. */
  split: boolean
  /** Which pane this is. A swap changes it, and the scroll position is put back. */
  place: 1 | 2
  /** What a right-click may do. Absent: no menu (nothing is writable). */
  menuOps?: GraphMenuOps
  /** Opens the pane's conflict editor for a file in conflict. Absent: the rows only show it. */
  onResolveConflict?: (file: string) => void
}

export interface GraphMenuOps {
  /** A write is already running, so the entries are off. */
  busy: boolean
  checkout: (target: CheckoutTarget) => void
  deleteBranch: (name: string) => void
  /** `origin/topic`: asks, then removes the branch on the remote. */
  deleteRemoteBranch: (name: string) => void
  createBranch: (startPoint: string, startLabel: string) => void
  renameBranch: (name: string) => void
  cherryPick: (hash: string) => void
  merge: (branch: string, noFf: boolean) => void
  rebase: (onto: string) => void
  revert: (hash: string) => void
  reset: (hash: string, mode: ResetMode) => void
  /** Opens the Tags dialog on this commit. */
  createTag: (hash: string) => void
  /** The checked-out branch, `null` while detached. */
  currentBranch: string | null
  /** A merge, cherry-pick, revert or rebase is waiting, so no second one starts. */
  operationActive: boolean
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
  watchToken,
  onChanged,
  narrow,
  split,
  place,
  menuOps,
  onResolveConflict
}: GitGraphProps) {
  const idPrefix = useId()
  const now = useNow()
  const statusState = useStatus(path, reloadToken + watchToken, visible)
  const { status } = statusState
  // Uncommitted changes sit on top of HEAD as a "// WIP" row. No commits yet: no row.
  const wipHead = status && status.entries.length > 0 ? status.head : null
  const graph = useGraph(path, reloadToken, wipHead, status?.head ?? null)
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
  const wipSelected = selected?.hash === WIP_HASH
  // The WIP row has no commit behind it, so it has no detail to read.
  const selectedCommit = selected && !wipSelected ? selected : null
  const detail = useCommitDetail(path, selectedCommit?.hash ?? null)
  // The file whose diff is open, for the selected commit or for the WIP row.
  const [diffFile, setDiffFile] = useState<DiffRequest | null>(null)
  const openDiff =
    diffFile && (diffFile.source === 'commit' ? diffFile.hash === selected?.hash : wipSelected)
      ? diffFile
      : null
  const diff = useDiff(path, openDiff, reloadToken + watchToken)
  const [hunkBusy, setHunkBusy] = useState(false)
  const [hunkError, setHunkError] = useState<string | null>(null)

  async function runHunk(source: 'worktree' | 'staged', request: HunkRequest): Promise<void> {
    if (!path || hunkBusy) return
    setHunkBusy(true)
    setHunkError(null)
    try {
      if (source === 'staged') await window.api.local.unstageHunk(path, request)
      else await window.api.local.stageHunk(path, request)
    } catch (err) {
      setHunkError(errorMessage(err))
    } finally {
      setHunkBusy(false)
      // Status, the diff and the Changes lists read the folder again.
      onChanged()
    }
  }

  // The last file was committed or discarded while the WIP row was selected.
  if (selectedHash === WIP_HASH && wipHead === null && status !== null) setSelectedHash(null)

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
      case 'delete-remote-branch':
        return menuOps.deleteRemoteBranch(action.name)
      case 'merge':
        return menuOps.merge(action.branch, action.noFf)
      case 'cherry-pick':
        return menuOps.cherryPick(action.hash)
      case 'rebase':
        return menuOps.rebase(action.onto)
      case 'revert':
        return menuOps.revert(action.hash)
      case 'reset':
        return menuOps.reset(action.hash, action.mode)
      case 'create-tag':
        return menuOps.createTag(action.hash)
      case 'copy':
        void navigator.clipboard?.writeText(action.text).catch(() => {})
    }
  }

  function menuEntries(commit: GraphCommit, ref: BadgeView | null): MenuEntry[] {
    const items = refActions(
      ref ? { kind: ref.refKind, name: ref.name, current: ref.current } : null,
      commit.hash,
      menuOps && {
        currentBranch: menuOps.currentBranch,
        isMerge: commit.parents.length > 1,
        operationActive: menuOps.operationActive
      }
    )
    return refMenuEntries(
      items,
      menuOps?.currentBranch ?? null,
      !!menuOps?.busy,
      (action) => runAction(action, commit),
      ref?.name
    )
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

  const placement = detailPlacement(split, narrow)
  const firstLoad = rows.length === 0 && (loading || (!done && error === null))
  const emptyRepo = rows.length === 0 && done && error === null
  const failedFirst = rows.length === 0 && error !== null

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-2"
      data-detail={selected ? 'open' : 'closed'}
      data-narrow={narrow ? 'true' : undefined}
    >
      <div
        className={cn(
          'relative grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-3',
          selected && placement === 'side' && 'grid-cols-[minmax(0,1fr)_minmax(280px,360px)]',
          selected && placement === 'below' && 'grid-rows-[minmax(0,1fr)_minmax(160px,40%)]'
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
                  wipCount={status?.entries.length}
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

        {selectedCommit ? (
          <CommitDetailPanel
            key={selectedCommit.hash}
            commit={selectedCommit}
            state={detail}
            defaultBranch={defaultBranch}
            onClose={() => setSelectedHash(null)}
            onOpenFile={(file) =>
              setDiffFile({ source: 'commit', hash: selectedCommit.hash, path: file })
            }
          />
        ) : null}
        {/* Always mounted, so a commit message being written survives selecting a commit. */}
        <ChangesPanel
          path={path}
          hidden={!wipSelected}
          status={status}
          loading={statusState.loading}
          error={statusState.error}
          reload={statusState.reload}
          onChanged={onChanged}
          onOpenFile={(source, file) => setDiffFile({ source, path: file })}
          onResolveFile={(file) => onResolveConflict?.(file)}
          onClose={() => setSelectedHash(null)}
        />
        {menu && menuOps ? (
          <Menu
            // A new menu for each place, so it opens at the pointer and not where the last one was.
            key={`${menu.x}:${menu.y}`}
            label="Commit actions"
            at={{ x: menu.x, y: menu.y }}
            entries={menuEntries(menu.commit, menu.ref)}
            onClose={() => setMenu(null)}
          />
        ) : null}
        {openDiff ? (
          <Dialog
            title={
              openDiff.source === 'commit'
                ? `Changes in commit ${openDiff.hash?.slice(0, 7)}`
                : `${openDiff.source === 'staged' ? 'Staged' : 'Unstaged'} changes`
            }
            width={960}
            onClose={() => setDiffFile(null)}
          >
            {hunkError ? (
              <ErrorBanner onDismiss={() => setHunkError(null)}>{hunkError}</ErrorBanner>
            ) : null}
            <DiffView
              path={openDiff.path}
              state={diff}
              hunkAction={
                openDiff.source !== 'commit' &&
                canStageHunks(
                  status?.entries.find((e) => e.path === openDiff.path),
                  openDiff.source
                )
                  ? {
                      label: openDiff.source === 'staged' ? 'Unstage hunk' : 'Stage hunk',
                      busy: hunkBusy,
                      lineDirection: openDiff.source === 'staged' ? 'unstage' : 'stage',
                      onRun: (index, fingerprint, lines) =>
                        void runHunk(openDiff.source as 'worktree' | 'staged', {
                          path: openDiff.path,
                          source: openDiff.source as 'worktree' | 'staged',
                          index,
                          fingerprint,
                          ...(lines ? { lines } : {})
                        })
                    }
                  : undefined
              }
            />
          </Dialog>
        ) : null}
      </div>
    </div>
  )
}
