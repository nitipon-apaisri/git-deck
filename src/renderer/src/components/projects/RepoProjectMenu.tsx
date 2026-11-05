import type { Project, Repo } from '@shared/types'
import { Icon, Menu, ProjectIcon, type MenuEntry } from '../ui'

interface RepoProjectMenuProps {
  repo: Repo
  at: { x: number; y: number }
  projects: Project[]
  /** The active project scope, if any: it gets a "Remove from project" item. */
  scope: Project | null
  onToggle: (projectId: string, member: boolean) => void
  onNewProject: () => void
  onClose: () => void
}

/** "Add to project…" as a checkbox list of projects, plus "New project…". */
export function RepoProjectMenu({
  repo,
  at,
  projects,
  scope,
  onToggle,
  onNewProject,
  onClose
}: RepoProjectMenuProps) {
  const inScope = scope?.repoKeys.includes(repo.key) ?? false
  const entries: MenuEntry[] = [
    { kind: 'heading', id: 'heading', label: 'Add to project' },
    ...projects.map((p): MenuEntry => {
      const member = p.repoKeys.includes(repo.key)
      return {
        kind: 'item',
        id: p.id,
        label: p.name,
        leading: <ProjectIcon icon={p.icon} color={p.color} size="sm" />,
        checked: member,
        keepOpen: true,
        onSelect: () => onToggle(p.id, !member)
      }
    }),
    ...(projects.length > 0 ? [{ kind: 'separator', id: 'sep' } satisfies MenuEntry] : []),
    {
      kind: 'item',
      id: 'new',
      label: 'New project…',
      leading: <Icon name="plus" size="sm" />,
      onSelect: onNewProject
    },
    ...(scope && inScope
      ? [
          { kind: 'separator', id: 'sep-remove' } satisfies MenuEntry,
          {
            kind: 'item',
            id: 'remove',
            label: `Remove from ${scope.name}`,
            leading: <Icon name="x" size="sm" />,
            danger: true,
            onSelect: () => onToggle(scope.id, false)
          } satisfies MenuEntry
        ]
      : [])
  ]
  return <Menu label={`Projects for ${repo.name}`} at={at} entries={entries} onClose={onClose} />
}
