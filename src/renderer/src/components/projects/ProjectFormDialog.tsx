import { useId, useMemo, useState, type FormEvent } from 'react'
import type { Account, Project, Repo } from '@shared/types'
import { DEFAULT_ICON, PROJECT_COLORS } from '@shared/projects'
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
import styles from './ProjectFormDialog.module.css'

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
      <form id={formId} className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
        <Field
          label="Name"
          error={problem}
          hint={
            <span className={styles.nameHint}>
              <span className={styles.ok}>
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

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Icon</legend>
          <div className={styles.iconTools}>
            <label className={styles.search}>
              <Icon name="search" size="sm" />
              <input
                type="search"
                className={styles.searchInput}
                aria-label="Search icons"
                placeholder="Search icons"
                value={iconQuery}
                onChange={(e) => setIconQuery(e.target.value)}
              />
            </label>
            <TextInput
              className={styles.emoji}
              aria-label="Or paste an emoji"
              aria-invalid={emojiBad ? true : undefined}
              placeholder="Or paste an emoji"
              value={emojiText}
              onChange={(e) => onEmoji(e.target.value)}
            />
          </div>
          {emojiBad ? (
            <span role="alert" className={styles.problem}>
              <Icon name="alert" size="sm" />
              Use one emoji, or pick an icon below.
            </span>
          ) : null}
          <div className={styles.iconGrid}>
            {icons.map((id) => (
              <button
                key={id}
                type="button"
                className={styles.iconButton}
                aria-label={iconLabel(id)}
                aria-pressed={icon === id}
                title={iconLabel(id)}
                onClick={() => pickBuiltIn(id)}
              >
                {isIconName(id) ? <Icon name={id} /> : null}
              </button>
            ))}
            {icons.length === 0 ? (
              <p className={styles.none}>No icon matches “{iconQuery.trim()}”.</p>
            ) : null}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Color</legend>
          <div className={styles.swatches}>
            {PROJECT_COLORS.map((id) => (
              <button
                key={id}
                type="button"
                className={styles.swatch}
                data-color={id}
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

        <div className={styles.preview} aria-label="Preview">
          <ProjectIcon icon={icon} color={color} size="lg" />
          <div className={styles.previewText}>
            <span className={styles.previewName}>{name.trim() || 'Untitled project'}</span>
            <span className={styles.previewSub}>
              Preview · {chosen.size} {chosen.size === 1 ? 'repository' : 'repositories'}
            </span>
          </div>
        </div>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>
            Repositories <span className={styles.optional}>(optional)</span>
          </legend>
          <div className={styles.repoTools}>
            <label className={styles.search}>
              <Icon name="search" size="sm" />
              <input
                type="search"
                className={styles.searchInput}
                aria-label="Filter repositories to add"
                placeholder="Filter repositories"
                value={repoQuery}
                onChange={(e) => setRepoQuery(e.target.value)}
              />
            </label>
            <span className={styles.selected} aria-live="polite">
              {chosen.size} selected
            </span>
          </div>
          <div className={styles.repoBox}>
            {groups.map(({ accountId, repos }) => {
              const account = accounts.find((a) => a.id === accountId)
              const tile = account ? hostTileOf(account.type, account.baseUrl) : null
              return (
                <div key={accountId} role="group" aria-label={account?.label ?? accountId}>
                  <div className={styles.hostRow}>
                    {tile ? <HostTile tile={tile.tile} host={tile.host} /> : null}
                    <span className={styles.hostName}>{account?.label ?? accountId}</span>
                    <span className={styles.where}>{account?.host}</span>
                  </div>
                  {repos.map((r) => (
                    <label key={r.key} className={styles.repoRow}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        aria-label={`Add ${r.fullName}`}
                        checked={chosen.has(r.key)}
                        onChange={(e) => toggle(r.key, e.target.checked)}
                      />
                      <span className={styles.repoName}>{r.name}</span>
                      <span className={styles.where}>{r.namespace}</span>
                    </label>
                  ))}
                </div>
              )
            })}
            {missing.length > 0 ? (
              <div role="group" aria-label="Unavailable">
                <div className={styles.hostRow}>
                  <Icon name="alert" size="sm" />
                  <span className={styles.hostName}>Unavailable</span>
                </div>
                {missing.map((key) => (
                  <label key={key} className={styles.repoRow}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      aria-label={`Keep ${remoteIdOf(key)}`}
                      checked={chosen.has(key)}
                      onChange={(e) => toggle(key, e.target.checked)}
                    />
                    <span className={styles.repoName}>{remoteIdOf(key)}</span>
                    <span className={styles.where}>access lost or account removed</span>
                  </label>
                ))}
              </div>
            ) : null}
            {groups.length === 0 && missing.length === 0 ? (
              <p className={styles.none}>
                {repoQuery.trim() !== ''
                  ? `No repositories match “${repoQuery.trim()}”.`
                  : 'No repositories loaded yet. Connect an account first.'}
              </p>
            ) : null}
          </div>
        </fieldset>

        {saveError ? (
          <span role="alert" className={styles.problem}>
            <Icon name="alert" size="sm" />
            {saveError}
          </span>
        ) : null}
      </form>
    </Dialog>
  )
}
