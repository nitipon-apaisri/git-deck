import { IconButton } from './ui'
import styles from './Rail.module.css'

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
  onOpenAccounts,
  onOpenProjects,
  onOpenPreferences
}: RailProps) {
  return (
    <nav className={styles.rail} aria-label="Main">
      <div className={styles.group}>
        <IconButton
          size="rail"
          icon="repo"
          label="Repositories"
          active={sidebarOpen}
          aria-pressed={sidebarOpen}
          onClick={onToggleSidebar}
        />
        <IconButton size="rail" icon="layers" label="Projects" onClick={onOpenProjects} />
        <IconButton size="rail" icon="users" label="Accounts" onClick={onOpenAccounts} />
      </div>
      <IconButton size="rail" icon="sliders" label="Preferences" onClick={onOpenPreferences} />
    </nav>
  )
}
