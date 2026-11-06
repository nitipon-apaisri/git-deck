import type { Account, Project } from '@shared/types'
import type { Orientation } from '../lib/splitState'
import { ScopeSwitcher } from './projects/ScopeSwitcher'
import { IconButton } from './ui'

interface ToolbarProps {
  /** macOS: no native title bar, so leave room for the traffic lights. */
  insetTitleBar: boolean
  /** Not shown for now: the accounts button is hidden. */
  accounts: Account[]
  onOpenAccounts: () => void
  splitEnabled: boolean
  orientation: Orientation
  onToggleSplit: () => void
  onToggleOrientation: () => void
  onSwap: () => void
  /** The scope selector shows once there is something to select. */
  showScope: boolean
  projects: Project[]
  scope: Project | null
  onScope: (projectId: string | null) => void
  onNewProject: () => void
  onManage: () => void
  onOpenPreferences: () => void
}

export function Toolbar({
  insetTitleBar,
  splitEnabled,
  orientation,
  onToggleSplit,
  onToggleOrientation,
  onSwap,
  showScope,
  projects,
  scope,
  onScope,
  onNewProject,
  onManage,
  onOpenPreferences
}: ToolbarProps) {
  return (
    <header
      className="flex h-(--toolbar-height) flex-none items-center gap-2 px-3 data-[inset=true]:pl-(--titlebar-inset) [-webkit-app-region:drag] [&_button]:[-webkit-app-region:no-drag] [&_label]:[-webkit-app-region:no-drag]"
      data-inset={insetTitleBar ? 'true' : undefined}
    >
      {showScope ? (
        <div className="w-[240px] min-w-0">
          <ScopeSwitcher
            projects={projects}
            scope={scope}
            onSelect={onScope}
            onNew={onNewProject}
            onManage={onManage}
          />
        </div>
      ) : null}
      <span className="flex-1" />
      <div className="flex items-center justify-end gap-1" role="group" aria-label="Split view">
        {splitEnabled ? (
          <>
            <IconButton
              label={
                orientation === 'horizontal'
                  ? 'Stack the panes on top of each other'
                  : 'Put the panes side by side'
              }
              icon="rotate"
              onClick={onToggleOrientation}
            />
            <IconButton label="Swap the panes" icon="swap" onClick={onSwap} />
          </>
        ) : null}
        <IconButton
          label="Split view (Ctrl/Cmd+Alt+S)"
          icon="columns"
          active={splitEnabled}
          aria-pressed={splitEnabled}
          onClick={onToggleSplit}
        />
        <IconButton label="Preferences" icon="sliders" onClick={onOpenPreferences} />
      </div>
    </header>
  )
}
