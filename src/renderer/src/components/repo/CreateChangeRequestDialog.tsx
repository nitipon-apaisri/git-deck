import { useEffect, useState, type FormEvent } from 'react'
import type { BranchList, ChangeRequest } from '@shared/types'
import { errorMessage } from '../../lib/errors'
import {
  Button,
  CheckOption,
  Dialog,
  ErrorBanner,
  Field,
  Select,
  TextInput,
  Textarea,
  type SelectOption
} from '../ui'

interface Props {
  repoKey: string
  /** The clone to read the last commit from and push out of. */
  linkedPath: string
  branches: BranchList
  defaultBranch: string
  short: 'PR' | 'MR'
  /** The host's own create page: the way out when the token cannot write. */
  fallbackUrl: string
  onCreated: (cr: ChangeRequest) => void
  onClose: () => void
}

const FORM_ID = 'create-change-request-form'

const asOptions = (xs: string[]): SelectOption[] => xs.map((b) => ({ value: b, label: b }))

const unique = (xs: string[]): string[] => [...new Set(xs.filter(Boolean))]

export function CreateChangeRequestDialog({
  repoKey,
  linkedPath,
  branches,
  defaultBranch,
  short,
  fallbackUrl,
  onCreated,
  onClose
}: Props) {
  const [head, setHead] = useState(branches.current ?? '')
  const [base, setBase] = useState(defaultBranch)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [draft, setDraft] = useState(false)
  // Remote branches come as `origin/main`; the host wants the name without the remote.
  const remoteNames = branches.remote.map((r) => {
    const remote = branches.remotes.find((n) => r.startsWith(`${n}/`))
    return remote ? r.slice(remote.length + 1) : r
  })
  const headOptions = unique([head, ...branches.local.map((b) => b.name)])
  const baseOptions = unique([defaultBranch, ...remoteNames, base])
  const local = branches.local.find((b) => b.name === head)
  // `git push` here only ever pushes the checked-out branch, so offer it for that one.
  const canPush = head === branches.current && (!local?.upstream || local.ahead > 0)
  const [push, setPush] = useState(!local?.upstream)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // The last commit subject is the usual title; never overwrite what was typed meanwhile.
  useEffect(() => {
    let live = true
    window.api.local
      .graph(linkedPath, 0, 1)
      .then((c) => live && setTitle((t) => t || (c[0]?.subject ?? '')))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [linkedPath])

  const ready = title.trim() && head.trim() && base.trim() && head.trim() !== base.trim()

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!ready || saving) return
    setSaving(true)
    setError(null)
    try {
      if (push && canPush) await window.api.local.push(linkedPath, false)
      onCreated(
        await window.api.changes.create(repoKey, {
          title: title.trim(),
          body,
          head: head.trim(),
          base: base.trim(),
          draft
        })
      )
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Dialog
      title={`Create ${short}`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={!ready || saving}>
            {saving ? 'Working…' : `Create ${short}`}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
        {error ? (
          <ErrorBanner>
            {error}{' '}
            <button
              type="button"
              className="underline"
              onClick={() => void window.api.openExternal(fallbackUrl)}
            >
              Open the host&apos;s page instead
            </button>
          </ErrorBanner>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="From branch">
            {(c) => (
              <Select {...c} options={asOptions(headOptions)} value={head} onChange={setHead} />
            )}
          </Field>
          <Field label="Into branch">
            {(c) => (
              <Select {...c} options={asOptions(baseOptions)} value={base} onChange={setBase} />
            )}
          </Field>
        </div>
        <Field label="Title">
          {(c) => (
            <TextInput
              {...c}
              data-autofocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>
        <Field label="Description">
          {(c) => <Textarea {...c} value={body} onChange={(e) => setBody(e.target.value)} />}
        </Field>
        <CheckOption label="Draft" checked={draft} onChange={setDraft} />
        {canPush ? (
          <CheckOption
            label={local?.upstream ? 'Push new commits first' : 'Push this branch first'}
            checked={push}
            onChange={setPush}
          />
        ) : null}
      </form>
    </Dialog>
  )
}
