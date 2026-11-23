import { useEffect, useMemo, useState } from 'react'
import { changelogMarkdown, groupChangelog, parseSubject } from '@shared/changelog'
import type { ChangelogCommit } from '@shared/changelog'
import type { TagEntry } from '@shared/types'
import { errorMessage } from '../../lib/errors'
import { Button, CopyButton, Dialog, ErrorBanner, Field, Select } from '../ui'

interface ChangelogDialogProps {
  path: string
  /** Newest first. */
  tags: TagEntry[]
  onOpenCommit: (hash: string) => void
  onBack: () => void
  onClose: () => void
}

/** Sentinel for "from the first commit". A tag cannot be empty. */
const START = ''

/** The commits between two tags, grouped by type, as a list and as Markdown. */
export function ChangelogDialog({
  path,
  tags,
  onOpenCommit,
  onBack,
  onClose
}: ChangelogDialogProps) {
  const [to, setTo] = useState(tags[0]?.name ?? '')
  const [from, setFrom] = useState(tags[1]?.name ?? START)
  const [commits, setCommits] = useState<ChangelogCommit[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!to) return
    let cancelled = false
    window.api.local
      .changelog(path, from === START ? null : from, to)
      .then((data) => !cancelled && setCommits(data))
      .catch((err) => !cancelled && setProblem(errorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [path, from, to])

  // A new range clears the old list at once, so it never shows under the wrong tags.
  function pick(set: (v: string) => void, value: string): void {
    set(value)
    setCommits(null)
    setProblem(null)
  }

  const groups = useMemo(() => groupChangelog(commits ?? []), [commits])
  const markdown = useMemo(
    () => changelogMarkdown(from === START ? null : from, to, groups),
    [from, to, groups]
  )
  const toOptions = tags.map((t) => ({ value: t.name, label: t.name }))
  const fromOptions = [{ value: START, label: 'Start of history' }, ...toOptions]

  return (
    <Dialog
      title="Change log"
      description="The commits between two tags, grouped by type."
      width={560}
      onClose={onClose}
      actionsStart={
        <Button variant="ghost" onClick={onBack}>
          Back to tags
        </Button>
      }
      actions={commits ? <CopyButton text={markdown} what="change log as Markdown" /> : null}
    >
      <div className="flex flex-col gap-4">
        {tags.length === 0 ? (
          <p className="m-0 text-muted-foreground">This repository has no tags.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              {(control) => (
                <Select
                  {...control}
                  options={fromOptions}
                  value={from}
                  onChange={(v) => pick(setFrom, v)}
                />
              )}
            </Field>
            <Field label="To">
              {(control) => (
                <Select
                  {...control}
                  options={toOptions}
                  value={to}
                  onChange={(v) => pick(setTo, v)}
                />
              )}
            </Field>
          </div>
        )}
        {problem ? <ErrorBanner onDismiss={() => setProblem(null)}>{problem}</ErrorBanner> : null}
        {commits === null && !problem && to ? (
          <p className="m-0 text-muted-foreground">Loading…</p>
        ) : null}
        {commits?.length === 0 ? (
          <p className="m-0 text-muted-foreground">No commits in this range.</p>
        ) : null}
        {groups.map((group) => (
          <section key={group.type} className="flex flex-col gap-1" aria-label={group.title}>
            <h4 className="m-0 text-[12px] leading-4.5 font-semibold text-muted-foreground">
              {group.title} · {group.commits.length}
            </h4>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {group.commits.map((c) => (
                <li key={c.hash}>
                  <button
                    type="button"
                    onClick={() => onOpenCommit(c.hash)}
                    className="flex w-full cursor-pointer items-baseline gap-2 rounded-md border-0 bg-secondary px-3 py-2 text-left text-[13px] text-foreground hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      {c.merge ? c.subject : parseSubject(c.subject).text}
                    </span>
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      {c.hash.slice(0, 7)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  )
}
