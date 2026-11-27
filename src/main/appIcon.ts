import { join } from 'node:path'
import { app } from 'electron'
import type { AppIconId } from '../shared/appIcon'

/** Source of the packaged icons too: build/icons/<id>.png. */
export function appIconPath(id: AppIconId): string {
  return join(app.getAppPath(), 'build', 'icons', `${id}.png`)
}
