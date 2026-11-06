import { useRef, type KeyboardEvent } from 'react'
import type { Account } from '@shared/types'
import {
  SETTINGS_SECTIONS,
  sectionAfterKey,
  type SettingsSection
} from '../../lib/settingsSections'
import type { ThemeSetting } from '../../lib/theme'
import { Icon, IconButton, type IconName } from '../ui'
import { Modal, ModalTitle } from '../ui/Dialog'
import { AppearanceSection } from './AppearanceSection'
import { IntegrationsSection } from './IntegrationsSection'

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
  const tabs = useRef<Partial<Record<SettingsSection, HTMLButtonElement | null>>>({})

  function onKeyDown(event: KeyboardEvent): void {
    const next = sectionAfterKey(section, event.key)
    if (next === null) return
    event.preventDefault()
    onSection(next)
    tabs.current[next]?.focus()
  }

  return (
    <Modal
      onClose={onClose}
      className="h-[calc(100vh-80px)] max-h-none w-[calc(100vw-80px)] max-w-none flex-row"
    >
      <aside className="flex w-52 flex-none flex-col gap-3 bg-background px-3 py-4">
        <ModalTitle className="m-0 px-2 text-[15px] leading-[22px] font-semibold">
          Settings
        </ModalTitle>
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
              className="flex h-[34px] w-full cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-2 text-left text-muted-foreground transition-[background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-accent hover:text-foreground aria-selected:bg-card aria-selected:font-medium aria-selected:text-foreground aria-selected:hover:bg-card"
              onClick={() => onSection(id)}
              onKeyDown={onKeyDown}
            >
              <Icon name={ICONS[id]} size="sm" />
              {label}
            </button>
          ))}
        </div>
      </aside>
      <div className="relative flex min-w-0 flex-1">
        <div className="absolute top-3 right-3 z-[1]">
          <IconButton label="Close settings" icon="x" onClick={onClose} />
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto px-10 py-6">
          {SETTINGS_SECTIONS.map(({ id, label }) => (
            <section
              key={id}
              role="tabpanel"
              id={`settings-panel-${id}`}
              aria-labelledby={`settings-tab-${id}`}
              hidden={id !== section}
              className="animate-in fade-in-0 max-w-[640px] duration-[var(--motion-base)] ease-[var(--ease-out)]"
            >
              <h2 className="m-0 mb-4 text-[20px] leading-[26px] font-semibold">{label}</h2>
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
    </Modal>
  )
}
