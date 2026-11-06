import { useRef, useState } from 'react'
import type { Project } from '@shared/types'
import { Icon, Menu, ProjectIcon, type MenuEntry } from '../ui'

interface ScopeSwitcherProps {
  projects: Project[]
  /** The active project, or `null` for "All repositories". */
  scope: Project | null
  /** `null` picks "All repositories". */
  onSelect: (projectId: string | null) => void
  onNew: () => void
  onManage: () => void
}

/** The scope button at the top of the sidebar and the menu it opens. */
export function ScopeSwitcher({ projects, scope, onSelect, onNew, onManage }: ScopeSwitcherProps) {
  const button = useRef<HTMLButtonElement>(null)
  const [at, setAt] = useState<{ x: number; y: number; width: number } | null>(null)

  function open(): void {
    const rect = button.current?.getBoundingClientRect()
    if (rect) setAt({ x: rect.left, y: rect.bottom + 4, width: rect.width })
  }

  const entries: MenuEntry[] = [
    {
      kind: 'item',
      id: 'all',
      label: 'All repositories',
      leading: <ProjectIcon icon="repo" color="gray" size="sm" />,
      checked: scope === null,
      radio: true,
      onSelect: () => onSelect(null)
    },
    ...(projects.length > 0 ? [{ kind: 'separator', id: 'sep-projects' } satisfies MenuEntry] : []),
    ...projects.map((p): MenuEntry => ({
      kind: 'item',
      id: p.id,
      label: p.name,
      leading: <ProjectIcon icon={p.icon} color={p.color} size="sm" />,
      trailing: p.repoKeys.length,
      checked: scope?.id === p.id,
      radio: true,
      onSelect: () => onSelect(p.id)
    })),
    { kind: 'separator', id: 'sep-actions' },
    {
      kind: 'item',
      id: 'new',
      label: 'New project…',
      leading: <Icon name="plus" size="sm" />,
      onSelect: onNew
    },
    {
      kind: 'item',
      id: 'manage',
      label: 'Manage projects…',
      leading: <Icon name="sliders" size="sm" />,
      onSelect: onManage
    }
  ]

  return (
    <>
      <button
        ref={button}
        type="button"
        className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-secondary pr-2.5 pl-1.5 text-left text-foreground hover:bg-accent [&_svg:last-child]:text-muted-foreground"
        aria-haspopup="menu"
        aria-expanded={at !== null}
        aria-label={`Scope: ${scope ? scope.name : 'All repositories'}. Change scope`}
        onClick={open}
      >
        {scope ? (
          <ProjectIcon icon={scope.icon} color={scope.color} size="sm" />
        ) : (
          <ProjectIcon icon="repo" color="gray" size="sm" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">
          {scope ? scope.name : 'All repositories'}
        </span>
        {scope ? (
          <span className="text-[12px] text-muted-foreground">{scope.repoKeys.length}</span>
        ) : null}
        <Icon name="chevron-down" size="sm" />
      </button>
      {at ? (
        <Menu
          label="Scope"
          at={at}
          minWidth={at.width}
          entries={entries}
          onClose={() => setAt(null)}
        />
      ) : null}
    </>
  )
}
