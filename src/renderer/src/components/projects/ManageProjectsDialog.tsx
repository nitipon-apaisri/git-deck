import { useState } from 'react'
import type { Project } from '@shared/types'
import { Button, Dialog, Icon, IconButton, ProjectIcon } from '../ui'

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
        <p className="m-0 text-muted-foreground">
          No projects yet. Create one to group repositories.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {projects.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <ProjectIcon icon={p.icon} color={p.color} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{p.name}</span>
                  <span className="text-[12px] text-muted-foreground">
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
                <div
                  className="flex flex-col gap-2 rounded-md bg-secondary px-3 py-2"
                  role="alertdialog"
                  aria-label={`Delete ${p.name}?`}
                >
                  <span className="flex items-start gap-2">
                    <Icon name="alert" size="sm" />
                    <span>
                      Delete “{p.name}”? The repositories and any local clones are not touched.
                    </span>
                  </span>
                  <span className="flex justify-end gap-2">
                    <Button onClick={() => setConfirming(null)} disabled={busy}>
                      Cancel
                    </Button>
                    <Button
                      className="border-destructive text-destructive"
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
        <span
          role="alert"
          className="flex items-start gap-2 text-[12px] leading-4 text-destructive"
        >
          <Icon name="alert" size="sm" />
          {error}
        </span>
      ) : null}
    </Dialog>
  )
}
