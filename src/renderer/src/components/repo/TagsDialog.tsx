import { useEffect, useState, type FormEvent } from 'react'
import type { TagEntry } from '@shared/types'
import { errorMessage } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import { tagDetail, tagStartLabel } from '../../lib/historyView'
import { useNow } from '../../state/useNow'
import { Button, Dialog, ErrorBanner, Field, Textarea, TextInput } from '../ui'

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
    } catch (err) {
      setFieldError(errorMessage(err))
    } finally {
      setBusy(false)
      reload()
      onChanged()
    }
  }

  return (
    <Dialog
      title="Tags"
      description={`A new tag points at ${tagStartLabel(startHash)}.`}
      width={560}
      onClose={onClose}
      actions={<Button onClick={onClose}>Close</Button>}
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
          <div>
            <Button variant="primary" icon="tag" type="submit" disabled={busy || !name.trim()}>
              Create tag
            </Button>
          </div>
        </form>

        {problem ? <ErrorBanner onDismiss={() => setProblem(null)}>{problem}</ErrorBanner> : null}
        {note ? (
          <p className="m-0 text-muted-foreground" role="status">
            {note}
          </p>
        ) : null}

        <section className="flex flex-col gap-1" aria-label="Tags">
          <h4 className="m-0 text-[12px] leading-[18px] font-semibold text-muted-foreground">
            Tags · {(tags?.length ?? 0).toLocaleString('en-GB')}
          </h4>
          {tags === null ? (
            <p className="m-0 text-muted-foreground">Loading…</p>
          ) : tags.length === 0 ? (
            <p className="m-0 text-muted-foreground">This repository has no tags.</p>
          ) : (
            <ul className="m-0 flex max-h-[320px] list-none flex-col gap-1 overflow-auto p-0">
              {tags.map((tag) => (
                <li
                  key={tag.name}
                  className="flex flex-wrap items-center gap-2 rounded-md bg-secondary px-3 py-2"
                >
                  <div className="min-w-0 flex-[1_1_12rem]">
                    <p className="m-0 font-medium [overflow-wrap:anywhere]">{tag.name}</p>
                    <p className="m-0 text-[12px] text-muted-foreground [overflow-wrap:anywhere]">
                      {tagDetail(tag)} · {timeAgo(tag.createdAt * 1000, now)}
                    </p>
                  </div>
                  <Button
                    disabled={busy}
                    icon="arrow-up"
                    title="Push this tag to the remote"
                    onClick={() =>
                      void act(
                        () => window.api.local.pushTag(path, tag.name),
                        `Pushed ${tag.name}.`
                      )
                    }
                  >
                    Push
                  </Button>
                  <Button
                    variant="ghost"
                    icon="trash"
                    disabled={busy}
                    title="Delete the local tag"
                    onClick={() => void act(() => window.api.local.deleteTag(path, tag.name))}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    title="Delete this tag on the remote"
                    onClick={() =>
                      void act(
                        () => window.api.local.deleteRemoteTag(path, tag.name),
                        `Deleted ${tag.name} on the remote.`
                      )
                    }
                  >
                    Delete on remote
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  )
}
