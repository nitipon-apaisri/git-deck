import { useId, useMemo, useState, type FormEvent } from 'react'
import type { Account, Project, Repo } from '@shared/types'
import { DEFAULT_ICON, PROJECT_COLORS } from '@shared/projects'
import { cn } from '@/lib/cn'
import { LOCAL_ACCOUNT_ID } from '../../lib/localRepos'
import { hostTileOf } from '../../lib/presets'
import {
  COLOR_LABELS,
  NAME_LIMIT,
  filterIcons,
  iconLabel,
  isBuiltInIcon,
  nameProblem,
  pickerGroups,
  readEmojiField,
  remoteIdOf,
  type ProjectFormValue
} from '../../lib/projectForm'
import { Button, Dialog, Field, HostTile, Icon, ProjectIcon, TextInput, isIconName } from '../ui'

interface ProjectFormDialogProps {
  projects: Project[]
  /** `null` creates a project. */
  editing: Project | null
  /** Repositories ticked at the start of a new project, for example the one right-clicked. */
  initialRepoKeys: string[]
  accounts: Account[]
  reposByAccount: Record<string, Repo[]>
  /** Rejects with a plain message, which the form shows. */
  onSave: (value: ProjectFormValue) => Promise<void>
  onClose: () => void
}

/** New or edit project: name, icon, colour and repositories, with a live preview. */
// `--swatch` is the palette colour of a project colour id.
const SWATCHES: Record<string, string> = {
  blue: '[--swatch:var(--proj-blue)]',
  teal: '[--swatch:var(--proj-teal)]',
  violet: '[--swatch:var(--proj-violet)]',
  amber: '[--swatch:var(--proj-amber)]',
  rose: '[--swatch:var(--proj-rose)]',
  green: '[--swatch:var(--proj-green)]',
  pink: '[--swatch:var(--proj-pink)]',
  gray: '[--swatch:var(--proj-gray)]'
}

export function ProjectFormDialog({
  projects,
  editing,
  initialRepoKeys,
  accounts,
  reposByAccount,
  onSave,
  onClose
}: ProjectFormDialogProps) {
  const formId = useId()
  const [name, setName] = useState(editing?.name ?? '')
  const [touched, setTouched] = useState(false)
  const [icon, setIcon] = useState(editing?.icon ?? DEFAULT_ICON)
  const [emojiText, setEmojiText] = useState(
    editing && !isBuiltInIcon(editing.icon) ? editing.icon : ''
  )
  const [iconQuery, setIconQuery] = useState('')
  const [color, setColor] = useState(editing?.color ?? PROJECT_COLORS[0])
  const [repoQuery, setRepoQuery] = useState('')
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(editing ? editing.repoKeys : initialRepoKeys)
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const problem = nameProblem(name, projects, editing?.id, touched)
  const nameOk = name.trim() !== '' && nameProblem(name, projects, editing?.id, true) === null
  const emoji = readEmojiField(emojiText)
  const emojiBad = emoji.kind === 'invalid'
  const canSave = nameOk && !emojiBad && !saving

  const icons = useMemo(() => filterIcons(iconQuery), [iconQuery])
  const { groups, missing } = useMemo(
    () =>
      pickerGroups(
        accounts.map((a) => a.id),
        reposByAccount,
        chosen,
        repoQuery
      ),
    [accounts, reposByAccount, chosen, repoQuery]
  )

  function onEmoji(text: string): void {
    setEmojiText(text)
    const next = readEmojiField(text)
    if (next.kind === 'ok') setIcon(next.icon)
    else if (next.kind === 'empty' && !isBuiltInIcon(icon)) setIcon(DEFAULT_ICON)
  }

  function pickBuiltIn(id: string): void {
    setIcon(id)
    setEmojiText('')
  }

  function toggle(key: string, on: boolean): void {
    setChosen((current) => {
      const next = new Set(current)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    setTouched(true)
    if (!canSave) return
    setSaving(true)
    setSaveError(null)
    try {
      await onSave({ name: name.trim(), icon, color, repoKeys: [...chosen] })
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the project')
      setSaving(false)
    }
  }

  return (
    <Dialog
      width={560}
      title={editing ? 'Edit project' : 'New project'}
      description="Group repositories from any host under one name."
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form={formId} disabled={!canSave}>
            {editing ? 'Save changes' : 'Create project'}
          </Button>
        </>
      }
    >
      <form id={formId} className="flex flex-col gap-4" onSubmit={(e) => void submit(e)} noValidate>
        <Field
          label="Name"
          error={problem}
          hint={
            <span className="flex justify-between gap-3">
              <span className="inline-flex items-center gap-1 text-[var(--success-text)]">
                {nameOk ? (
                  <>
                    <Icon name="check" size="xs" />
                    Name is available
                  </>
                ) : null}
              </span>
              <span>
                {[...name.trim()].length} / {NAME_LIMIT}
              </span>
            </span>
          }
        >
          {(control) => (
            <TextInput
              {...control}
              data-autofocus
              value={name}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
            />
          )}
        </Field>

        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 font-medium">Icon</legend>
          <div className="flex items-center gap-2">
            <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-[var(--border-strong)] px-2.5 text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus-ring)]">
              <Icon name="search" size="sm" />
              <input
                type="search"
                className="min-w-0 flex-1 border-0 bg-transparent text-foreground outline-0 placeholder:text-muted-foreground"
                aria-label="Search icons"
                placeholder="Search icons"
                value={iconQuery}
                onChange={(e) => setIconQuery(e.target.value)}
              />
            </label>
            <TextInput
              className="h-8 w-[150px]"
              aria-label="Or paste an emoji"
              aria-invalid={emojiBad ? true : undefined}
              placeholder="Or paste an emoji"
              value={emojiText}
              onChange={(e) => onEmoji(e.target.value)}
            />
          </div>
          {emojiBad ? (
            <span
              role="alert"
              className="flex items-start gap-2 text-[12px] leading-4 text-destructive"
            >
              <Icon name="alert" size="sm" />
              Use one emoji, or pick an icon below.
            </span>
          ) : null}
          <div className="grid grid-cols-8 gap-1.5">
            {icons.map((id) => (
              <button
                key={id}
                type="button"
                className="grid h-11 cursor-pointer place-items-center rounded-lg border border-border bg-transparent text-foreground hover:bg-accent aria-pressed:border-[var(--accent)] aria-pressed:bg-[var(--selection)] aria-pressed:text-[var(--accent-text)]"
                aria-label={iconLabel(id)}
                aria-pressed={icon === id}
                title={iconLabel(id)}
                onClick={() => pickBuiltIn(id)}
              >
                {isIconName(id) ? <Icon name={id} /> : null}
              </button>
            ))}
            {icons.length === 0 ? (
              <p className="col-span-full m-0 py-2 text-muted-foreground">
                No icon matches “{iconQuery.trim()}”.
              </p>
            ) : null}
          </div>
        </fieldset>

        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 font-medium">Color</legend>
          <div className="flex flex-wrap gap-2.5">
            {PROJECT_COLORS.map((id) => (
              <button
                key={id}
                type="button"
                className={cn(
                  'grid size-7 cursor-pointer place-items-center rounded-full border-2 border-transparent bg-[var(--swatch)] p-0 text-[var(--island)] shadow-[inset_0_0_0_2px_var(--island)] aria-pressed:border-foreground',
                  SWATCHES[id]
                )}
                aria-label={COLOR_LABELS[id]}
                aria-pressed={color === id}
                title={COLOR_LABELS[id]}
                onClick={() => setColor(id)}
              >
                {color === id ? <Icon name="check" size="sm" /> : null}
              </button>
            ))}
          </div>
        </fieldset>

        <div
          className="flex items-center gap-3 rounded-xl bg-secondary px-[14px] py-3"
          aria-label="Preview"
        >
          <ProjectIcon icon={icon} color={color} size="lg" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] font-semibold">
              {name.trim() || 'Untitled project'}
            </span>
            <span className="text-[12px] text-muted-foreground">
              Preview · {chosen.size} {chosen.size === 1 ? 'repository' : 'repositories'}
            </span>
          </div>
        </div>

        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 font-medium">
            Repositories <span className="font-normal text-muted-foreground">(optional)</span>
          </legend>
          <div className="flex items-center gap-2">
            <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-[var(--border-strong)] px-2.5 text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus-ring)]">
              <Icon name="search" size="sm" />
              <input
                type="search"
                className="min-w-0 flex-1 border-0 bg-transparent text-foreground outline-0 placeholder:text-muted-foreground"
                aria-label="Filter repositories to add"
                placeholder="Filter repositories"
                value={repoQuery}
                onChange={(e) => setRepoQuery(e.target.value)}
              />
            </label>
            <span className="flex-none text-[12px] text-muted-foreground" aria-live="polite">
              {chosen.size} selected
            </span>
          </div>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
            {groups.map(({ accountId, repos }) => {
              const account = accounts.find((a) => a.id === accountId)
              const tile =
                account && account.id !== LOCAL_ACCOUNT_ID
                  ? hostTileOf(account.type, account.baseUrl)
                  : null
              return (
                <div key={accountId} role="group" aria-label={account?.label ?? accountId}>
                  <div className="flex h-8 items-center gap-2.5 bg-secondary px-3 font-semibold text-foreground">
                    {tile ? (
                      <HostTile tile={tile.tile} host={tile.host} />
                    ) : (
                      <Icon name="folder" size="sm" />
                    )}
                    <span className="min-w-0 truncate">{account?.label ?? accountId}</span>
                    <span className="ml-auto flex-none text-[12px] font-normal text-muted-foreground">
                      {account?.host}
                    </span>
                  </div>
                  {repos.map((r) => (
                    <label
                      key={r.key}
                      className="flex h-[34px] cursor-pointer items-center gap-2.5 border-t border-border px-3 hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        className="m-0 size-4 accent-[var(--accent)]"
                        aria-label={`Add ${r.fullName}`}
                        checked={chosen.has(r.key)}
                        onChange={(e) => toggle(r.key, e.target.checked)}
                      />
                      <span className="min-w-0 truncate font-medium">{r.name}</span>
                      <span className="ml-auto flex-none text-[12px] font-normal text-muted-foreground">
                        {r.accountId === LOCAL_ACCOUNT_ID ? '' : r.namespace}
                      </span>
                    </label>
                  ))}
                </div>
              )
            })}
            {missing.length > 0 ? (
              <div role="group" aria-label="Unavailable">
                <div className="flex h-8 items-center gap-2.5 bg-secondary px-3 font-semibold text-foreground">
                  <Icon name="alert" size="sm" />
                  <span className="min-w-0 truncate">Unavailable</span>
                </div>
                {missing.map((key) => (
                  <label
                    key={key}
                    className="flex h-[34px] cursor-pointer items-center gap-2.5 border-t border-border px-3 hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      className="m-0 size-4 accent-[var(--accent)]"
                      aria-label={`Keep ${remoteIdOf(key)}`}
                      checked={chosen.has(key)}
                      onChange={(e) => toggle(key, e.target.checked)}
                    />
                    <span className="min-w-0 truncate font-medium">{remoteIdOf(key)}</span>
                    <span className="ml-auto flex-none text-[12px] font-normal text-muted-foreground">
                      access lost or account removed
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
            {groups.length === 0 && missing.length === 0 ? (
              <p className="m-0 p-3 text-muted-foreground">
                {repoQuery.trim() !== ''
                  ? `No repositories match “${repoQuery.trim()}”.`
                  : 'No repositories loaded yet. Connect an account first.'}
              </p>
            ) : null}
          </div>
        </fieldset>

        {saveError ? (
          <span
            role="alert"
            className="flex items-start gap-2 text-[12px] leading-4 text-destructive"
          >
            <Icon name="alert" size="sm" />
            {saveError}
          </span>
        ) : null}
      </form>
    </Dialog>
  )
}
