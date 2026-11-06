// The Settings sections and the keyboard rule for moving between them.
export const SETTINGS_SECTIONS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'integrations', label: 'Integrations' }
] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]['id']

/** The section a key moves to: Up/Down (or Left/Right) wrap, Home and End jump. */
export function sectionAfterKey(current: SettingsSection, key: string): SettingsSection | null {
  const ids = SETTINGS_SECTIONS.map((s) => s.id)
  const index = ids.indexOf(current)
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return ids[(index + 1) % ids.length]
    case 'ArrowUp':
    case 'ArrowLeft':
      return ids[(index - 1 + ids.length) % ids.length]
    case 'Home':
      return ids[0]
    case 'End':
      return ids[ids.length - 1]
    default:
      return null
  }
}
