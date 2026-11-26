import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { BranchList, WorktreeEntry } from '@shared/types'
import { errorMessage } from '../../lib/errors'
import { Button, CheckOption, Dialog, ErrorBanner, Field, Select, TextInput } from '../ui'

interface WorktreesDialogProps {
  /** The linked folder. */
  path: string
  branches: BranchList | null
  /** The worktree list or the sidebar changed: the workspace reads them again. */
  onChanged: () => void
  onClose: () => void
}

const FORM_ID = 'worktree-form'

/** Extra working folders of this repository, each on its own branch. */
export function WorktreesDialog({ path, branches, onChanged, onClose }: WorktreesDialogProps) {
  const [list, setList] = useState<WorktreeEntry[] | null>(null)
  const [create, setCreate] = useState(true)
  const [newName, setNewName] = useState('')
  const [existing, setExisting] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  /** A worktree with changes: removing it needs a second, forced go. */
  const [forceFor, setForceFor] = useState<string | null>(null)

  const load = useCallback(
    () =>
      window.api.local
        .worktrees(path)
        .then(setList, (err: unknown) => setProblem(errorMessage(err))),
    [path]
  )

  useEffect(() => {
    void load()
  }, [load])

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
      await load()
      onChanged()
    }
  }

  async function remove(folder: string, force: boolean): Promise<void> {
    setBusy(true)
    setProblem(null)
    try {
      await window.api.local.worktreeRemove(path, folder, force)
      setForceFor(null)
    } catch (err) {
      const message = errorMessage(err)
      setProblem(message)
      // A worktree with changes is the one failure a second, forced click can fix.
      setForceFor(/has changes/.test(message) ? folder : null)
    } finally {
      setBusy(false)
      await load()
      onChanged()
    }
  }

  async function add(event: FormEvent): Promise<void> {
    event.preventDefault()
    const branch = create ? newName : chosen
    if (busy || !branch.trim()) return
    if (await act(() => window.api.local.worktreeAdd(path, branch, create))) setNewName('')
  }

  // A branch checked out in a worktree cannot be checked out in a second one.
  const taken = new Set((list ?? []).map((w) => w.branch).filter((b): b is string => b !== null))
  const free = (branches?.local ?? []).map((b) => b.name).filter((name) => !taken.has(name))
  const chosen = free.includes(existing) ? existing : (free[0] ?? '')

  return (
    <Dialog
      title="Worktrees"
      description="Check out more than one branch at once, each in its own folder."
      width={560}
      onClose={onClose}
      actions={
        <>
          <Button
            disabled={busy}
            onClick={() => void act(() => window.api.local.worktreePrune(path))}
            title="Forget worktrees whose folder is gone"
          >
            Prune
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <form id={FORM_ID} className="flex flex-col gap-3" onSubmit={(e) => void add(e)}>
          <CheckOption label="Create a new branch" checked={create} onChange={setCreate} />
          {create ? (
            <Field label="New branch name" hint="Starts from the current commit.">
              {(control) => (
                <TextInput
                  {...control}
                  data-autofocus
                  value={newName}
                  autoComplete="off"
                  disabled={busy}
                  onChange={(e) => setNewName(e.target.value)}
                />
              )}
            </Field>
          ) : (
            <Field label="Branch" hint="Branches already open in a worktree are not listed.">
              {(control) => (
                <Select
                  id={control.id}
                  value={chosen}
                  disabled={busy || free.length === 0}
                  options={free.map((name) => ({ value: name, label: name }))}
                  onChange={setExisting}
                />
              )}
            </Field>
          )}
          <div>
            <Button
              variant="primary"
              icon="plus"
              type="submit"
              disabled={busy || (create ? !newName.trim() : !chosen)}
            >
              Add worktree…
            </Button>
          </div>
        </form>

        {problem ? <ErrorBanner onDismiss={() => setProblem(null)}>{problem}</ErrorBanner> : null}

        <section className="flex flex-col gap-1" aria-label="Worktrees">
          <h4 className="m-0 text-[12px] leading-4.5 font-semibold text-muted-foreground">
            Worktrees · {(list?.length ?? 0).toLocaleString('en-GB')}
          </h4>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {(list ?? []).map((w) => (
              <li
                key={w.path}
                className="flex flex-wrap items-center gap-2 rounded-md bg-secondary px-3 py-2"
              >
                <div className="min-w-0 flex-[1_1_12rem]">
                  <p className="m-0 [overflow-wrap:anywhere]">
                    {w.branch ?? (w.bare ? 'bare' : `detached at ${w.head.slice(0, 7)}`)}
                    {w.isMain ? ' · main' : ''}
                    {w.locked !== null ? ' · locked' : ''}
                    {w.prunable !== null ? ' · missing' : ''}
                  </p>
                  <p className="m-0 text-[12px] text-muted-foreground [overflow-wrap:anywhere]">
                    {w.path}
                    {w.locked ? ` · ${w.locked}` : ''}
                  </p>
                </div>
                {w.isMain ? null : (
                  <>
                    {w.repoKey === null && w.prunable === null ? (
                      <Button
                        disabled={busy}
                        title="Show this worktree under the repository in the sidebar"
                        onClick={() => void act(() => window.api.local.worktreeOpen(path, w.path))}
                      >
                        Add to sidebar
                      </Button>
                    ) : null}
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void act(() =>
                          window.api.local.worktreeLock(path, w.path, w.locked === null)
                        )
                      }
                    >
                      {w.locked === null ? 'Lock' : 'Unlock'}
                    </Button>
                    <Button
                      variant="danger"
                      icon="trash"
                      disabled={busy || w.locked !== null || w.prunable !== null}
                      title={w.locked !== null ? 'Unlock it first' : undefined}
                      onClick={() => void remove(w.path, forceFor === w.path)}
                    >
                      {forceFor === w.path ? 'Remove anyway' : 'Remove'}
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Dialog>
  )
}
