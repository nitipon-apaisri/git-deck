import { THEME_SETTINGS, type ThemeSetting } from '../lib/theme'
import { Button, ChoiceGroup, Dialog, type Choice } from './ui'

const TITLES: Record<ThemeSetting, { title: string; sub: string }> = {
  system: { title: 'System', sub: 'Follows your OS' },
  dark: { title: 'Dark', sub: 'Always dark' },
  light: { title: 'Light', sub: 'Always light' }
}

const CHOICES: readonly Choice<ThemeSetting>[] = THEME_SETTINGS.map((value) => ({
  value,
  ...TITLES[value]
}))

interface PreferencesDialogProps {
  setting: ThemeSetting
  onChange: (setting: ThemeSetting) => void
  onClose: () => void
}

export function PreferencesDialog({ setting, onChange, onClose }: PreferencesDialogProps) {
  return (
    <Dialog
      title="Preferences"
      description="Saved on this computer."
      onClose={onClose}
      actions={<Button onClick={onClose}>Close</Button>}
    >
      <ChoiceGroup
        label="Theme"
        value={setting}
        options={CHOICES}
        onChange={onChange}
        columns={3}
      />
    </Dialog>
  )
}
