// App icon choices: the default first, then by colour (yellow, orange, black). Files are
// build/icons/<id>.png. Pure: no electron, so a test can use it.
export const APP_ICONS = [
  { id: 'sun', label: 'Sun (default)' },
  { id: 'honey', label: 'Honey' },
  { id: 'ember', label: 'Ember' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'lantern', label: 'Lantern' },
  { id: 'night', label: 'Night' }
] as const

export type AppIconId = (typeof APP_ICONS)[number]['id']
export const DEFAULT_APP_ICON: AppIconId = 'sun'

export function isAppIconId(value: unknown): value is AppIconId {
  return APP_ICONS.some((icon) => icon.id === value)
}
