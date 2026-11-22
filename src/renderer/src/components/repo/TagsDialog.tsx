import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import type { TagEntry } from '@shared/types'
import { errorMessage } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import { tagKind, tagStartLabel } from '../../lib/historyView'
import { useNow } from '../../state/useNow'
import {
  Button,
  Dialog,
  ErrorBanner,
  Field,
  Icon,
  IconButton,
  Menu,
  Textarea,
  TextInput,
  type MenuEntry
} from '../ui'

interface TagsDialogProps {
  /** The linked folder. */
  path: string
  /** A commit to tag, or `null` for the checked-out commit. */
  startHash: string | null
  /** Something changed: the graph reads its tags and badges again. */
  onChanged: () => void
  onClose: () => void
}

const FORM_ID = 'tag-form'
/** The search box only earns its room once the list is long. */
const SEARCH_FROM = 8
const NOTE_MS = 4000

/** Three lines of 12px text at 18px. */
const CLAMP_PX = 54

const MORE_CLASS =
  'inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-3 text-[12px] text-foreground transition-colors duration-(--motion-fast) hover:bg-accent'

/** A tag message cut to three lines with a fade; "View more" shows up only when it is cut. */
function TagMessage({ text }: { text: string }) {
  const box = useRef<HTMLParagraphElement>(null)
  const [open, setOpen] = useState(false)
  const [cut, setCut] = useState(false)
  // The full height, so max-height has a number to animate to.
  const [full, setFull] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    // Against the clamp, not clientHeight: that is mid-transition after a collapse.
    setFull(el.scrollHeight)
    setCut(el.scrollHeight > CLAMP_PX + 1)
  }, [text])
  return (
    <div className="mt-1">
      <div className="relative">
        <p
          ref={box}
          style={{ maxHeight: open ? full : CLAMP_PX }}
          className="m-0 overflow-hidden text-[12px] text-muted-foreground transition-[max-height] duration-(--motion-base) ease-(--ease-out) [overflow-wrap:anywhere]"
        >
          {text}
        </p>
        {cut ? (
          <>
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-secondary from-35% to-transparent transition-opacity duration-(--motion-base) ease-(--ease-out) ${open ? 'opacity-0' : 'opacity-100'}`}
            />
            <div
              className={`absolute inset-x-0 bottom-0.5 flex justify-center transition-[opacity,transform] duration-(--motion-base) ease-(--ease-out) ${open ? 'pointer-events-none translate-y-1 opacity-0' : 'opacity-100'}`}
            >
              <button
                type="button"
                aria-expanded={false}
                tabIndex={open ? -1 : 0}
                className={MORE_CLASS}
                onClick={() => setOpen(true)}
              >
                View more
                <Icon name="chevron-down" size="sm" />
              </button>
            </div>
          </>
        ) : null}
      </div>
      {open ? (
        <div className="animate-in fade-in-0 mt-0.5 flex justify-center duration-(--motion-base)">
          <button type="button" aria-expanded className={MORE_CLASS} onClick={() => setOpen(false)}>
            View less
            <span className="inline-grid rotate-180">
              <Icon name="chevron-down" size="sm" />
            </span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

/** Make a tag, push it, and delete it here or on the remote. */
export function TagsDialog({ path, startHash, onChanged, onClose }: TagsDialogProps) {
  const now = useNow()
  const [tags, setTags] = useState<TagEntry[] | null>(null)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [pushAfter, setPushAfter] = useState(false)
  const [filter, setFilter] = useState('')
  const [menu, setMenu] = useState<{ tag: TagEntry; x: number; y: number } | null>(null)

  // The status line goes away by itself.
  useEffect(() => {
    if (!note) return
    const timer = window.setTimeout(() => setNote(null), NOTE_MS)
    return () => window.clearTimeout(timer)
  }, [note])

  // Bumped after every change, so the list is read again.
  const [version, setVersion] = useState(0)
  const reload = (): void => setVersion((n) => n + 1)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await window.api.local.tags(path)
        if (!cancelled) setTags(data)
      } catch (err) {
        if (!cancelled) setProblem(errorMessage(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, version])

  async function act(work: () => Promise<unknown>, done?: string): Promise<boolean> {
    setBusy(true)
    setProblem(null)
    setNote(null)
    try {
      const result = await work()
      // A declined confirm resolves `false` and changes nothing.
      if (result !== false && done) setNote(done)
      return result !== false
    } catch (err) {
      setProblem(errorMessage(err))
      return false
    } finally {
      setBusy(false)
      reload()
      onChanged()
    }
  }

  async function create(event: FormEvent): Promise<void> {
    event.preventDefault()
    const tagName = name.trim()
    if (!tagName || busy) return
    setFieldError(null)
    setBusy(true)
    setProblem(null)
    try {
      await window.api.local.createTag(path, tagName, startHash, message.trim() || null)
      setName('')
      setMessage('')
      setNote(`Created ${tagName}.`)
      if (pushAfter) {
        try {
          await window.api.local.pushTag(path, tagName)
          setNote(`Created and pushed ${tagName}.`)
        } catch (err) {
          // The tag exists; only the push failed.
          setProblem(errorMessage(err))
        }
      }
    } catch (err) {
      setFieldError(errorMessage(err))
    } finally {
      setBusy(false)
      reload()
      onChanged()
    }
  }

  const entriesFor = (tag: TagEntry): MenuEntry[] => [
    {
      kind: 'item',
      id: 'copy-name',
      label: 'Copy name',
      leading: <Icon name="copy" size="sm" />,
      onSelect: () => void navigator.clipboard.writeText(tag.name)
    },
    {
      kind: 'item',
      id: 'copy-hash',
      label: 'Copy commit hash',
      leading: <Icon name="copy" size="sm" />,
      onSelect: () => void navigator.clipboard.writeText(tag.hash)
    },
    { kind: 'separator', id: 'sep' },
    {
      kind: 'item',
      id: 'delete',
      label: 'Delete locally',
      danger: true,
      leading: <Icon name="trash" size="sm" />,
      onSelect: () => void act(() => window.api.local.deleteTag(path, tag.name))
    },
    {
      kind: 'item',
      id: 'delete-remote',
      label: 'Delete on remote',
      danger: true,
      leading: <Icon name="trash" size="sm" />,
      onSelect: () =>
        void act(
          () => window.api.local.deleteRemoteTag(path, tag.name),
          `Deleted ${tag.name} on the remote.`
        )
    }
  ]

  const needle = filter.trim().toLowerCase()
  const shown = (tags ?? []).filter((t) => t.name.toLowerCase().includes(needle))

  return (
    <Dialog
      title="Tags"
      description={`A new tag points at ${tagStartLabel(startHash)}.`}
      width={560}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <form id={FORM_ID} className="flex flex-col gap-3" onSubmit={(e) => void create(e)}>
          <Field label="Tag name" error={fieldError} hint="For example v1.2.0">
            {(control) => (
              <TextInput
                {...control}
                data-autofocus
                value={name}
                spellCheck={false}
                autoComplete="off"
                disabled={busy}
                onChange={(e) => {
                  setName(e.target.value)
                  setFieldError(null)
                }}
              />
            )}
          </Field>
          <Field label="Message" hint="Optional. With a message the tag is annotated.">
            {(control) => (
              <Textarea
                {...control}
                value={message}
                maxLength={5000}
                disabled={busy}
                onChange={(e) => setMessage(e.target.value)}
              />
            )}
          </Field>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" icon="tag" type="submit" disabled={busy || !name.trim()}>
              Create tag
            </Button>
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                className="size-3.5 accent-(--accent)"
                checked={pushAfter}
                disabled={busy}
                onChange={(e) => setPushAfter(e.target.checked)}
              />
              Push to the remote after creating
            </label>
          </div>
        </form>

        {problem ? <ErrorBanner onDismiss={() => setProblem(null)}>{problem}</ErrorBanner> : null}
        {note ? (
          <p className="m-0 text-muted-foreground" role="status">
            {note}
          </p>
        ) : null}

        <section className="flex flex-col gap-1" aria-label="Tags">
          <h4 className="m-0 text-[12px] leading-4.5 font-semibold text-muted-foreground">
            Tags · {(tags?.length ?? 0).toLocaleString('en-GB')}
          </h4>
          {tags !== null && tags.length >= SEARCH_FROM ? (
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter tags…"
              aria-label="Filter tags"
              className="mb-1 h-8 w-full rounded-md border border-transparent bg-muted px-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-(--accent-text)"
            />
          ) : null}
          {tags === null ? (
            <p className="m-0 text-muted-foreground">Loading…</p>
          ) : tags.length === 0 ? (
            <p className="m-0 text-muted-foreground">This repository has no tags.</p>
          ) : shown.length === 0 ? (
            <p className="m-0 text-muted-foreground">No tag matches.</p>
          ) : (
            <ul className="m-0 flex max-h-80 list-none flex-col gap-1 overflow-auto p-0">
              {shown.map((tag) => (
                <li
                  key={tag.name}
                  className="flex items-start gap-1 rounded-md bg-secondary py-2 pr-2 pl-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="m-0 flex flex-wrap items-baseline gap-x-2 font-medium [overflow-wrap:anywhere]">
                      {tag.name}
                      <span className="text-[12px] font-normal text-muted-foreground">
                        {tagKind(tag)}
                      </span>
                    </p>
                    <p className="m-0 text-[12px] text-muted-foreground">
                      {tag.hash.slice(0, 7)} · {timeAgo(tag.createdAt * 1000, now)}
                    </p>
                    {tag.message ? <TagMessage text={tag.message} /> : null}
                  </div>
                  <IconButton
                    label="Push this tag to the remote"
                    icon="arrow-up"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        () => window.api.local.pushTag(path, tag.name),
                        `Pushed ${tag.name}.`
                      )
                    }
                  />
                  <IconButton
                    label={`More actions for ${tag.name}`}
                    icon="more"
                    disabled={busy}
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect()
                      setMenu({ tag, x: r.left, y: r.bottom + 4 })
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {menu ? (
        <Menu
          label={`Actions for ${menu.tag.name}`}
          at={{ x: menu.x, y: menu.y }}
          entries={entriesFor(menu.tag)}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </Dialog>
  )
}
