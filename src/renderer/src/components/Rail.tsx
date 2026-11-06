import { IconButton } from './ui'

interface RailProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onOpenAccounts: () => void
  onOpenProjects: () => void
  onOpenPreferences: () => void
}

export function Rail({
  sidebarOpen,
  onToggleSidebar,
  // onOpenAccounts,
  onOpenProjects,
  onOpenPreferences
}: RailProps) {
  return (
    <nav
      className="flex w-(--rail-width) flex-none flex-col items-center justify-between pb-1"
      aria-label="Main"
    >
      <div className="flex flex-col gap-1">
        <IconButton
          size="rail"
          icon="repo"
          label="Repositories"
          active={sidebarOpen}
          aria-pressed={sidebarOpen}
          onClick={onToggleSidebar}
        />
        <IconButton size="rail" icon="layers" label="Projects" onClick={onOpenProjects} />
        {/* <IconButton size="rail" icon="users" label="Accounts" onClick={onOpenAccounts} /> */}
      </div>
      <IconButton size="rail" icon="sliders" label="Preferences" onClick={onOpenPreferences} />
    </nav>
  )
}
