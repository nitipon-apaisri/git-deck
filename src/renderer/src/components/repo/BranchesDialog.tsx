import { useEffect, useState } from 'react'
import type { BranchDeleteResult, BranchList } from '@shared/types'
import { errorMessage } from '../../lib/errors'
import { trackingText } from '../../lib/branchView'
import { Button, Dialog, ErrorBanner, IconButton } from '../ui'

interface BranchesDialogProps {
  /** The linked folder. */
  path: string
  /** Something changed: the graph reads its branches again. */
  onChanged: () => void
  onClose: () => void
}

interface Row {
  /** `l:topic` or `r:origin/topic`: one key for both lists. */
  key: string
  name: string
  remote: boolean
  /** Why it cannot be selected, or `null`. */
  locked: string | null
  note: string
  upstream: boolean
  behind: boolean
}

const SEARCH_CLASS =
  'mb-1 h-8 w-full rounded-md border border-transparent bg-muted px-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-(--accent-text)'

function rowsOf(list: BranchList): { local: Row[]; remote: Row[] } {
  const local = list.local.map((b): Row => {
    const locked = b.current
      ? 'Checked out'
      : b.name === list.defaultBranch
        ? 'Default branch'
        : null
    return {
      key: `l:${b.name}`,
      name: b.name,
      remote: false,
      locked,
      note: locked ?? trackingText(b),
      upstream: b.upstream !== null,
      behind: b.behind > 0
    }
  })
  const remote = list.remote.map((name): Row => {
    const locked =
      name.slice(name.indexOf('/') + 1) === list.defaultBranch ? 'Default branch' : null
    return {
      key: `r:${name}`,
      name,
      remote: true,
      locked,
      note: locked ?? '',
      upstream: false,
      behind: false
    }
  })
  return { local, remote }
}

/** Delete many branches at once, and bring one up to date with its remote. */
export function BranchesDialog({ path, onChanged, onClose }: BranchesDialogProps) {
  const [list, setList] = useState<BranchList | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [force, setForce] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [results, setResults] = useState<BranchDeleteResult[] | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // Bumped after every change, so the list is read again.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await window.api.local.branches(path)
        if (!cancelled) setList(data)
      } catch (err) {
        if (!cancelled) setProblem(errorMessage(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, version])

  async function act(work: () => Promise<unknown>, done: string): Promise<void> {
    setBusy(true)
    setProblem(null)
    setNote(null)
    try {
      await work()
      setNote(done)
    } catch (err) {
      setProblem(errorMessage(err))
    } finally {
      setBusy(false)
      setVersion((n) => n + 1)
      onChanged()
    }
  }

  async function deleteSelected(rows: Row[]): Promise<void> {
    const items = rows
      .filter((r) => picked.has(r.key))
      .map((r) => ({ name: r.name, remote: r.remote }))
    if (items.length === 0) return
    setBusy(true)
    setProblem(null)
    setNote(null)
    setResults(null)
    try {
      const out = await window.api.local.deleteBranches(path, items, force)
      // Declined: nothing happened. Otherwise only the failures stay selected.
      if (out) {
        setResults(out)
        const failed = new Set(
          out.filter((r) => !r.ok).map((r) => `${r.remote ? 'r' : 'l'}:${r.name}`)
        )
        setPicked(failed)
      }
    } catch (err) {
      setProblem(errorMessage(err))
    } finally {
      setBusy(false)
      setVersion((n) => n + 1)
      onChanged()
    }
  }

  const needle = filter.trim().toLowerCase()
  const rows = list ? rowsOf(list) : { local: [], remote: [] }
  const match = (r: Row): boolean => r.name.toLowerCase().includes(needle)
  const all = [...rows.local, ...rows.remote]
  const count = all.filter((r) => picked.has(r.key)).length

  const section = (title: string, shown: Row[]) => (
    <section className="flex flex-col gap-1" aria-label={title}>
      <h4 className="m-0 text-[12px] leading-4.5 font-semibold text-muted-foreground">
        {title} · {shown.length.toLocaleString('en-GB')}
      </h4>
      {shown.length === 0 ? (
        <p className="m-0 text-muted-foreground">None.</p>
      ) : (
        <ul className="m-0 flex max-h-56 list-none flex-col gap-1 overflow-auto p-0">
          {shown.map((r) => (
            <li
              key={r.key}
              className="flex items-center gap-1 rounded-md bg-secondary py-1.5 pr-2 pl-3"
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="size-3.5 accent-(--accent)"
                  checked={picked.has(r.key)}
                  disabled={busy || r.locked !== null}
                  onChange={(e) =>
                    setPicked((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(r.key)
                      else next.delete(r.key)
                      return next
                    })
                  }
                />
                <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                {r.note ? (
                  <span className="text-[12px] text-muted-foreground">{r.note}</span>
                ) : null}
              </label>
              {r.remote ? null : (
                <>
                  <IconButton
                    label={`Push ${r.name}`}
                    icon="arrow-up"
                    disabled={busy}
                    onClick={() =>
                      void act(() => window.api.local.pushBranch(path, r.name), `Pushed ${r.name}.`)
                    }
                  />
                  <IconButton
                    label={`Fast-forward ${r.name} from its remote`}
                    icon="arrow-down"
                    disabled={busy || r.locked === 'Checked out' || !r.upstream || !r.behind}
                    onClick={() =>
                      void act(
                        () => window.api.local.fastForwardBranch(path, r.name),
                        `Fast-forwarded ${r.name}.`
                      )
                    }
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  return (
    <Dialog
      title="Branches"
      description="Select branches to delete. The checked-out and default branches are kept."
      width={560}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter branches…"
          aria-label="Filter branches"
          className={SEARCH_CLASS}
        />
        {problem ? <ErrorBanner onDismiss={() => setProblem(null)}>{problem}</ErrorBanner> : null}
        {note ? (
          <p className="m-0 text-muted-foreground" role="status">
            {note}
          </p>
        ) : null}
        {list === null ? (
          <p className="m-0 text-muted-foreground">Loading…</p>
        ) : (
          <>
            {section('Local', rows.local.filter(match))}
            {section('Remote', rows.remote.filter(match))}
          </>
        )}
        {results ? (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[12px]" aria-label="Results">
            {results.map((r) => (
              <li
                key={`${r.remote}:${r.name}`}
                className={r.ok ? 'text-muted-foreground' : 'text-destructive'}
              >
                {r.ok ? 'Deleted' : 'Kept'} {r.name}
                {r.error ? `: ${r.error}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className="size-3.5 accent-(--accent)"
              checked={force}
              disabled={busy}
              onChange={(e) => setForce(e.target.checked)}
            />
            Force delete unmerged local branches
          </label>
          <Button
            className="ml-auto"
            variant="danger"
            icon="trash"
            disabled={busy || count === 0}
            onClick={() => void deleteSelected(all)}
          >
            {count > 0 ? `Delete selected (${count})` : 'Delete selected'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
