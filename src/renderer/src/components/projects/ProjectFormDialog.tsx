import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Account, NotifyEvent, Project, Repo } from '@shared/types'
import { NOTIFY_EVENTS } from '@shared/notify'
import { DEFAULT_ICON, PROJECT_COLORS } from '@shared/projects'
import { cn } from '@/lib/cn'
import { LOCAL_ACCOUNT_ID } from '../../lib/localRepos'
import { hostTileOf } from '../../lib/presets'
import {
  COLOR_LABELS,
  NAME_LIMIT,
  filterIcons,
  flattenPicker,
  pickerRowHeight,
  iconLabel,
  isBuiltInIcon,
  nameProblem,
  pickerGroups,
  readEmojiField,
  remoteIdOf,
  type PickerRow,
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
  const [notify, setNotify] = useState<NotifyEvent[]>(editing?.notify ?? [])
  const [notifyOff, setNotifyOff] = useState(false)
  useEffect(() => {
    window.api.notify.enabled().then(
      (on) => setNotifyOff(!on),
      () => {}
    )
  }, [])
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

  const pickerRows = useMemo(() => flattenPicker(groups, missing), [groups, missing])
  const pickerRef = useRef<HTMLDivElement>(null)
  const picker = useVirtualizer({
    count: pickerRows.length,
    getScrollElement: () => pickerRef.current,
    estimateSize: (i) => pickerRowHeight(pickerRows[i]),
    getItemKey: (i) => pickerRows[i].key,
    overscan: 10
  })

  function renderPickerRow(row: PickerRow) {
    if (row.kind === 'header') {
      const account = accounts.find((a) => a.id === row.accountId)
      const tile =
        account && account.id !== LOCAL_ACCOUNT_ID
          ? hostTileOf(account.type, account.baseUrl)
          : null
      return (
        <div className="flex h-8 items-center gap-2.5 bg-secondary px-3 font-semibold text-foreground">
          {tile ? <HostTile tile={tile.tile} host={tile.host} /> : <Icon name="folder" size="sm" />}
          <span className="min-w-0 truncate">{account?.label ?? row.accountId}</span>
          <span className="ml-auto flex-none text-[12px] font-normal text-muted-foreground">
            {account?.host}
          </span>
        </div>
      )
    }
    if (row.kind === 'missing-header') {
      return (
        <div className="flex h-8 items-center gap-2.5 bg-secondary px-3 font-semibold text-foreground">
          <Icon name="alert" size="sm" />
          <span className="min-w-0 truncate">Unavailable</span>
        </div>
      )
    }
    const missingRow = row.kind === 'missing'
    const key = missingRow ? row.repoKey : row.repo.key
    return (
      <label className="flex h-8.5 cursor-pointer items-center gap-2.5 border-t border-border px-3 hover:bg-accent">
        <input
          type="checkbox"
          className="m-0 size-4 accent-(--accent)"
          aria-label={missingRow ? `Keep ${remoteIdOf(key)}` : `Add ${row.repo.fullName}`}
          checked={chosen.has(key)}
          onChange={(e) => toggle(key, e.target.checked)}
        />
        <span className="min-w-0 truncate font-medium">
          {missingRow ? remoteIdOf(key) : row.repo.name}
        </span>
        <span className="ml-auto flex-none text-[12px] font-normal text-muted-foreground">
          {missingRow
            ? 'access lost or account removed'
            : row.repo.accountId === LOCAL_ACCOUNT_ID
              ? ''
              : row.repo.namespace}
        </span>
      </label>
    )
  }

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
      await onSave({
        name: name.trim(),
        icon,
        color,
        repoKeys: [...chosen],
        ...(editing ? { notify } : {})
      })
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
              <span className="inline-flex items-center gap-1 text-(--success-text)">
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
            <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-(--border-strong) px-2.5 text-muted-foreground focus-within:border-(--accent-text)">
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
              className="h-8 w-37.5"
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
                className="grid h-11 cursor-pointer place-items-center rounded-lg border border-border bg-transparent text-foreground hover:bg-accent aria-pressed:border-(--accent) aria-pressed:bg-(--selection) aria-pressed:text-(--accent-text)"
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
                  'grid size-7 cursor-pointer place-items-center rounded-full border-2 border-transparent bg-(--swatch) p-0 text-(--island) shadow-[inset_0_0_0_2px_var(--island)] aria-pressed:border-foreground',
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
          className="flex items-center gap-3 rounded-xl bg-secondary px-3.5 py-3"
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
            <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-(--border-strong) px-2.5 text-muted-foreground focus-within:border-(--accent-text)">
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
          <div ref={pickerRef} className="max-h-60 overflow-y-auto rounded-lg border border-border">
            <div
              role="list"
              aria-label="Repositories"
              className="relative w-full"
              style={{ height: picker.getTotalSize() }}
            >
              {picker.getVirtualItems().map((item) => (
                <div
                  key={item.key}
                  role="listitem"
                  className="absolute top-0 left-0 w-full"
                  style={{ height: item.size, transform: `translateY(${item.start}px)` }}
                >
                  {renderPickerRow(pickerRows[item.index])}
                </div>
              ))}
            </div>
            {groups.length === 0 && missing.length === 0 ? (
              <p className="m-0 p-3 text-muted-foreground">
                {repoQuery.trim() !== ''
                  ? `No repositories match “${repoQuery.trim()}”.`
                  : 'No repositories loaded yet. Connect an account first.'}
              </p>
            ) : null}
          </div>
        </fieldset>

        {editing ? (
          <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 font-medium">
              Notifications{' '}
              <span className="font-normal text-muted-foreground">(off by default)</span>
            </legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {NOTIFY_EVENTS.map(({ id, label }) => (
                <label key={id} className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="m-0 size-4 accent-(--accent)"
                    checked={notify.includes(id)}
                    onChange={(e) =>
                      setNotify((current) =>
                        e.target.checked ? [...current, id] : current.filter((x) => x !== id)
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <span className="text-[12px] text-muted-foreground">
              Checks this project&apos;s hosted repositories every 2 minutes while GitDeck is open.
              {notifyOff ? ' Turned off in Settings > Notifications.' : ''}
            </span>
          </fieldset>
        ) : null}

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
