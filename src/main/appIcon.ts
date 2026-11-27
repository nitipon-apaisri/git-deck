import { join } from 'node:path'
import { app } from 'electron'
import type { AppIconId } from '../shared/appIcon'

/** Source of the packaged icons too: build/icon.png is the default, build/icons/<id>.png the rest. */
export function appIconPath(id: AppIconId): string {
  const build = join(app.getAppPath(), 'build')
  return id === 'default' ? join(build, 'icon.png') : join(build, 'icons', `${id}.png`)
}
