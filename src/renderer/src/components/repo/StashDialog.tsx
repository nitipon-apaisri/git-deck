import { useState, type FormEvent } from 'react'
import type { StashEntry } from '@shared/types'
import { errorMessage } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import { stashTitle } from '../../lib/operationView'
import { useNow } from '../../state/useNow'
import { Button, CheckOption, Dialog, ErrorBanner, Field, TextInput } from '../ui'

interface StashDialogProps {
  /** The linked folder. */
  path: string
  stashes: StashEntry[]
  /** Something changed on disk: graph, branches and the stash list read it again. */
  onChanged: () => void
  onClose: () => void
}

const FORM_ID = 'stash-form'

/** Save the working changes aside, and apply, pop or drop what was saved before. */
export function StashDialog({ path, stashes, onChanged, onClose }: StashDialogProps) {
  const now = useNow()
  const [message, setMessage] = useState('')
  const [untracked, setUntracked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function act(work: () => Promise<unknown>): Promise<boolean> {
    setBusy(true)
    setProblem(null)
    try {
      await work()
      return true
    } catch (err) {
      setProblem(errorMessage(err))
      return false
    } finally {
      setBusy(false)
      // Even a failed apply may have touched files.
      onChanged()
    }
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (busy) return
    if (await act(() => window.api.local.stashPush(path, message, untracked))) setMessage('')
  }

  return (
    <Dialog
      title="Stash"
      description="Put your uncommitted changes aside, then bring them back later."
      width={560}
      onClose={onClose}
      actions={<Button onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-col gap-4">
        <form id={FORM_ID} className="flex flex-col gap-3" onSubmit={(e) => void save(e)}>
          <Field label="Message" hint="Optional. Helps you tell stashes apart.">
            {(control) => (
              <TextInput
                {...control}
                data-autofocus
                value={message}
                maxLength={500}
                autoComplete="off"
                disabled={busy}
                onChange={(e) => setMessage(e.target.value)}
              />
            )}
          </Field>
          <CheckOption
            label="Include untracked files"
            checked={untracked}
            onChange={setUntracked}
          />
          <div>
            <Button variant="primary" icon="layers" type="submit" disabled={busy}>
              Stash changes
            </Button>
          </div>
        </form>

        {problem ? <ErrorBanner onDismiss={() => setProblem(null)}>{problem}</ErrorBanner> : null}

        <section className="flex flex-col gap-1" aria-label="Saved stashes">
          <h4 className="m-0 text-[12px] leading-[18px] font-semibold text-muted-foreground">
            Saved stashes · {stashes.length.toLocaleString('en-GB')}
          </h4>
          {stashes.length === 0 ? (
            <p className="m-0 text-muted-foreground">Nothing is stashed.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {stashes.map((entry) => (
                <li
                  key={entry.hash}
                  className="flex flex-wrap items-center gap-2 rounded-md bg-secondary px-3 py-2"
                >
                  <div className="min-w-0 flex-[1_1_12rem]">
                    <p className="m-0 [overflow-wrap:anywhere]">{stashTitle(entry)}</p>
                    <p className="m-0 text-[12px] text-muted-foreground">
                      {entry.branch ? `on ${entry.branch} · ` : ''}
                      {timeAgo(entry.createdAt * 1000, now)}
                    </p>
                  </div>
                  <Button
                    disabled={busy}
                    title="Apply and keep the stash"
                    onClick={() =>
                      void act(() => window.api.local.stashApply(path, entry.index, entry.hash))
                    }
                  >
                    Apply
                  </Button>
                  <Button
                    disabled={busy}
                    title="Apply and remove the stash"
                    onClick={() =>
                      void act(() => window.api.local.stashPop(path, entry.index, entry.hash))
                    }
                  >
                    Pop
                  </Button>
                  <Button
                    variant="ghost"
                    icon="trash"
                    disabled={busy}
                    onClick={() =>
                      void act(() => window.api.local.stashDrop(path, entry.index, entry.hash))
                    }
                  >
                    Drop
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
