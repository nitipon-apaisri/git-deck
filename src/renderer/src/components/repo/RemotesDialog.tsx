import { useEffect, useState, type FormEvent } from 'react'
import type { LocalRemote } from '@shared/types'
import { errorMessage } from '../../lib/errors'
import { remoteFormProblem } from '../../lib/historyView'
import { Button, Dialog, ErrorBanner, Field, TextInput } from '../ui'

interface RemotesDialogProps {
  /** The linked folder. */
  path: string
  /** Something changed: branches and the push and pull buttons read the folder again. */
  onChanged: () => void
  onClose: () => void
}

const FORM_ID = 'remote-form'

/** Add, rename and remove the remotes of a folder. URLs never carry a token. */
export function RemotesDialog({ path, onChanged, onClose }: RemotesDialogProps) {
  const [remotes, setRemotes] = useState<LocalRemote[] | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  // Bumped after every change, so the list is read again.
  const [version, setVersion] = useState(0)
  const reload = (): void => setVersion((n) => n + 1)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await window.api.local.remotes(path)
        if (!cancelled) setRemotes(data)
      } catch (err) {
        if (!cancelled) setProblem(errorMessage(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, version])

  async function act(work: () => Promise<unknown>): Promise<boolean> {
    setBusy(true)
    setProblem(null)
    try {
      return (await work()) !== false
    } catch (err) {
      setProblem(errorMessage(err))
      return false
    } finally {
      setBusy(false)
      reload()
      onChanged()
    }
  }

  async function add(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (busy) return
    const slip = remoteFormProblem(name, url)
    if (slip) return setFieldError(slip)
    setFieldError(null)
    setBusy(true)
    try {
      await window.api.local.addRemote(path, name.trim(), url.trim())
      setName('')
      setUrl('')
    } catch (err) {
      setFieldError(errorMessage(err))
    } finally {
      setBusy(false)
      reload()
      onChanged()
    }
  }

  async function rename(): Promise<void> {
    if (!renaming || !renaming.to.trim()) return
    const { from, to } = renaming
    if (await act(() => window.api.local.renameRemote(path, from, to.trim()))) setRenaming(null)
  }

  return (
    <Dialog
      title="Remotes"
      description="The servers this folder fetches from and pushes to."
      width={560}
      onClose={onClose}
      actions={<Button onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-col gap-4">
        <form id={FORM_ID} className="flex flex-col gap-3" onSubmit={(e) => void add(e)}>
          <Field label="Name" hint="For example origin or upstream">
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
          <Field
            label="URL"
            error={fieldError}
            hint="HTTPS or SSH. Tokens come from your accounts, never from the URL."
          >
            {(control) => (
              <TextInput
                {...control}
                value={url}
                spellCheck={false}
                autoComplete="off"
                disabled={busy}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setFieldError(null)
                }}
              />
            )}
          </Field>
          <div>
            <Button variant="primary" icon="plus" type="submit" disabled={busy}>
              Add remote
            </Button>
          </div>
        </form>

        {problem ? <ErrorBanner onDismiss={() => setProblem(null)}>{problem}</ErrorBanner> : null}

        <section className="flex flex-col gap-1" aria-label="Remotes">
          <h4 className="m-0 text-[12px] leading-[18px] font-semibold text-muted-foreground">
            Remotes · {(remotes?.length ?? 0).toLocaleString('en-GB')}
          </h4>
          {remotes === null ? (
            <p className="m-0 text-muted-foreground">Loading…</p>
          ) : remotes.length === 0 ? (
            <p className="m-0 text-muted-foreground">This repository has no remote.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {remotes.map((remote) => (
                <li
                  key={remote.name}
                  className="flex flex-wrap items-center gap-2 rounded-md bg-secondary px-3 py-2"
                >
                  {renaming?.from === remote.name ? (
                    <form
                      className="flex min-w-0 flex-[1_1_12rem] items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void rename()
                      }}
                    >
                      <TextInput
                        aria-label={`New name for ${remote.name}`}
                        data-autofocus
                        value={renaming.to}
                        spellCheck={false}
                        autoComplete="off"
                        disabled={busy}
                        onChange={(e) => setRenaming({ from: remote.name, to: e.target.value })}
                      />
                      <Button variant="primary" type="submit" disabled={busy}>
                        Save
                      </Button>
                      <Button disabled={busy} onClick={() => setRenaming(null)}>
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <>
                      <div className="min-w-0 flex-[1_1_12rem]">
                        <p className="m-0 font-medium [overflow-wrap:anywhere]">{remote.name}</p>
                        <p className="m-0 font-mono text-[12px] text-muted-foreground [overflow-wrap:anywhere]">
                          {remote.url}
                        </p>
                      </div>
                      <Button
                        disabled={busy}
                        onClick={() => setRenaming({ from: remote.name, to: remote.name })}
                      >
                        Rename
                      </Button>
                      <Button
                        variant="ghost"
                        icon="trash"
                        disabled={busy}
                        onClick={() =>
                          void act(() => window.api.local.removeRemote(path, remote.name))
                        }
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  )
}
