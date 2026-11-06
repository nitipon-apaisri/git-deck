import { useState, type FormEvent } from 'react'
import { Button, CheckOption, Dialog, Field, TextInput } from '../ui'

export type BranchNameRequest =
  | {
      kind: 'create'
      /** A branch name or commit hash, or `null` for the checked-out commit. */
      startPoint: string | null
      /** What it starts from, in words: `abc1234` or `the current commit`. */
      startLabel: string
    }
  | { kind: 'rename'; from: string }

interface BranchNameDialogProps {
  request: BranchNameRequest
  /** Resolves with the problem to show beside the field, or `null` when it worked. */
  onCreate: (name: string, startPoint: string | null, checkout: boolean) => Promise<string | null>
  onRename: (from: string, to: string) => Promise<string | null>
  onClose: () => void
}

const FORM_ID = 'branch-name-form'

/** One name field for a new branch or a rename. Git has the last word on what a name may be. */
export function BranchNameDialog({ request, onCreate, onRename, onClose }: BranchNameDialogProps) {
  const rename = request.kind === 'rename'
  const [name, setName] = useState(rename ? request.from : '')
  const [checkout, setCheckout] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const trimmed = name.trim()
  const unchanged = rename && trimmed === request.from

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!trimmed || unchanged || saving) return
    setSaving(true)
    setError(null)
    const problem = rename
      ? await onRename(request.from, trimmed)
      : await onCreate(trimmed, request.startPoint, checkout)
    setSaving(false)
    if (problem) setError(problem)
    else onClose()
  }

  return (
    <Dialog
      title={rename ? `Rename ${request.from}` : 'New branch'}
      description={rename ? undefined : `Starts from ${request.startLabel}.`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            form={FORM_ID}
            disabled={!trimmed || unchanged || saving}
          >
            {saving ? 'Working…' : rename ? 'Rename' : 'Create branch'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
        <Field label="Branch name" error={error} hint="For example feature/login">
          {(control) => (
            <TextInput
              {...control}
              data-autofocus
              value={name}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
            />
          )}
        </Field>
        {rename ? null : (
          <CheckOption label="Switch to the new branch" checked={checkout} onChange={setCheckout} />
        )}
      </form>
    </Dialog>
  )
}
