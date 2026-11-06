import { useRef, type KeyboardEvent } from 'react'
import type { Account } from '@shared/types'
import {
  SETTINGS_SECTIONS,
  sectionAfterKey,
  type SettingsSection
} from '../../lib/settingsSections'
import type { ThemeSetting } from '../../lib/theme'
import { Icon, IconButton, type IconName } from '../ui'
import { useModalDialog } from '../ui/useModalDialog'
import { AppearanceSection } from './AppearanceSection'
import { IntegrationsSection } from './IntegrationsSection'
import styles from './SettingsDialog.module.css'

const ICONS: Record<SettingsSection, IconName> = {
  appearance: 'palette',
  integrations: 'plug'
}

interface SettingsDialogProps {
  section: SettingsSection
  onSection: (next: SettingsSection) => void
  onClose: () => void
  theme: ThemeSetting
  onThemeChange: (next: ThemeSetting) => void
  accounts: Account[]
  secureStorage: boolean | null
  onAccountAdded: (account: Account) => void
  onAccountRemove: (accountId: string) => Promise<void>
}

/**
 * Settings: a section list on the left, the chosen section on the right. Both sections
 * stay mounted so a half-filled account form survives a trip to Appearance.
 */
export function SettingsDialog({
  section,
  onSection,
  onClose,
  theme,
  onThemeChange,
  accounts,
  secureStorage,
  onAccountAdded,
  onAccountRemove
}: SettingsDialogProps) {
  const ref = useModalDialog(onClose)
  const tabs = useRef<Partial<Record<SettingsSection, HTMLButtonElement | null>>>({})

  function onKeyDown(event: KeyboardEvent): void {
    const next = sectionAfterKey(section, event.key)
    if (next === null) return
    event.preventDefault()
    onSection(next)
    tabs.current[next]?.focus()
  }

  return (
    <dialog ref={ref} className={styles.dialog} aria-label="Settings">
      <aside className={styles.aside}>
        <h2 className={styles.title}>Settings</h2>
        <div role="tablist" aria-orientation="vertical" aria-label="Settings sections">
          {SETTINGS_SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              ref={(node) => {
                tabs.current[id] = node
              }}
              type="button"
              role="tab"
              id={`settings-tab-${id}`}
              aria-selected={id === section}
              aria-controls={`settings-panel-${id}`}
              tabIndex={id === section ? 0 : -1}
              className={styles.tab}
              onClick={() => onSection(id)}
              onKeyDown={onKeyDown}
            >
              <Icon name={ICONS[id]} size="sm" />
              {label}
            </button>
          ))}
        </div>
      </aside>
      <div className={styles.content}>
        <div className={styles.close}>
          <IconButton label="Close settings" icon="x" onClick={onClose} />
        </div>
        <div className={styles.scroll}>
          {SETTINGS_SECTIONS.map(({ id, label }) => (
            <section
              key={id}
              role="tabpanel"
              id={`settings-panel-${id}`}
              aria-labelledby={`settings-tab-${id}`}
              hidden={id !== section}
              className={styles.panel}
            >
              <h2 className={styles.heading}>{label}</h2>
              {id === 'appearance' ? (
                <AppearanceSection theme={theme} onThemeChange={onThemeChange} />
              ) : (
                <IntegrationsSection
                  accounts={accounts}
                  secureStorage={secureStorage}
                  onAdded={onAccountAdded}
                  onRemove={onAccountRemove}
                />
              )}
            </section>
          ))}
        </div>
      </div>
    </dialog>
  )
}
