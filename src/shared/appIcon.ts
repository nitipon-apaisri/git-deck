// App icon choices. Pure: no electron, so a test can use it. Files are build/icons/<id>.png.
export const APP_ICONS = [
  { id: 'ember', label: 'Ember' },
  { id: 'honey', label: 'Honey' },
  { id: 'lantern', label: 'Lantern' },
  { id: 'night', label: 'Night' },
  { id: 'sun', label: 'Sun (default)' },
  { id: 'sunset', label: 'Sunset' }
] as const

export type AppIconId = (typeof APP_ICONS)[number]['id']
export const DEFAULT_APP_ICON: AppIconId = 'sun'

export function isAppIconId(value: unknown): value is AppIconId {
  return APP_ICONS.some((icon) => icon.id === value)
}
