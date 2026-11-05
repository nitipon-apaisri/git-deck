import { useState } from 'react'
import type { Project } from '@shared/types'
import { Button, Dialog, Icon, IconButton, ProjectIcon } from '../ui'
import styles from './ManageProjectsDialog.module.css'

interface ManageProjectsDialogProps {
  projects: Project[]
  onNew: () => void
  onEdit: (projectId: string) => void
  /** Rejects with a plain message. */
  onDelete: (projectId: string) => Promise<void>
  onClose: () => void
}

/** The list of projects with create, edit and delete. Delete asks first. */
export function ManageProjectsDialog({
  projects,
  onNew,
  onEdit,
  onDelete,
  onClose
}: ManageProjectsDialogProps) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmDelete(id: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await onDelete(id)
      setConfirming(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the project')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Manage projects"
      description="A project groups repositories from any host under one name."
      onClose={onClose}
      actionsStart={
        <Button icon="plus" onClick={onNew}>
          New project
        </Button>
      }
      actions={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      {projects.length === 0 ? (
        <p className={styles.empty}>No projects yet. Create one to group repositories.</p>
      ) : (
        <ul className={styles.list}>
          {projects.map((p) => (
            <li key={p.id} className={styles.item}>
              <div className={styles.row}>
                <ProjectIcon icon={p.icon} color={p.color} />
                <span className={styles.text}>
                  <span className={styles.name}>{p.name}</span>
                  <span className={styles.sub}>
                    {p.repoKeys.length} {p.repoKeys.length === 1 ? 'repository' : 'repositories'}
                  </span>
                </span>
                <IconButton label={`Edit ${p.name}`} icon="edit" onClick={() => onEdit(p.id)} />
                <IconButton
                  label={`Delete ${p.name}`}
                  icon="trash"
                  onClick={() => {
                    setError(null)
                    setConfirming(p.id)
                  }}
                />
              </div>
              {confirming === p.id ? (
                <div className={styles.confirm} role="alertdialog" aria-label={`Delete ${p.name}?`}>
                  <span className={styles.confirmText}>
                    <Icon name="alert" size="sm" />
                    <span>
                      Delete “{p.name}”? The repositories and any local clones are not touched.
                    </span>
                  </span>
                  <span className={styles.confirmActions}>
                    <Button onClick={() => setConfirming(null)} disabled={busy}>
                      Cancel
                    </Button>
                    <Button
                      className={styles.danger}
                      onClick={() => void confirmDelete(p.id)}
                      disabled={busy}
                    >
                      Delete project
                    </Button>
                  </span>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <span role="alert" className={styles.error}>
          <Icon name="alert" size="sm" />
          {error}
        </span>
      ) : null}
    </Dialog>
  )
}
