// Remembers the last window bounds. No Electron import, so it runs under tsx tests.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowState extends Partial<Rect> {
  width: number
  height: number
  maximized: boolean
}

export const MIN_SIZE = { width: 1100, height: 700 }
const DEFAULT: WindowState = { width: 1280, height: 800, maximized: false }

const file = (dir: string): string => join(dir, 'window-state.json')

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Reads the saved state; anything missing or malformed falls back to the default size. */
export async function loadWindowState(dir: string): Promise<WindowState> {
  try {
    const raw = JSON.parse(await readFile(file(dir), 'utf8')) as Record<string, unknown>
    if (!isNum(raw.width) || !isNum(raw.height)) return { ...DEFAULT }
    const state: WindowState = {
      width: Math.max(MIN_SIZE.width, Math.round(raw.width)),
      height: Math.max(MIN_SIZE.height, Math.round(raw.height)),
      maximized: raw.maximized === true
    }
    if (isNum(raw.x) && isNum(raw.y)) {
      state.x = Math.round(raw.x)
      state.y = Math.round(raw.y)
    }
    return state
  } catch {
    return { ...DEFAULT }
  }
}

export async function saveWindowState(dir: string, state: WindowState): Promise<void> {
  try {
    await mkdir(dir, { recursive: true })
    const tmp = `${file(dir)}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(state), 'utf8')
    await rename(tmp, file(dir))
  } catch {
    // Losing the window size is not worth an error.
  }
}

const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/**
 * Drops the saved position when it no longer lies on any display (a monitor was
 * unplugged), so the window opens centred instead of off-screen.
 */
export function fitToDisplays(state: WindowState, workAreas: Rect[]): WindowState {
  if (state.x === undefined || state.y === undefined) return state
  const bounds: Rect = { x: state.x, y: state.y, width: state.width, height: state.height }
  if (workAreas.some((area) => overlap(bounds, area))) return state
  return { width: state.width, height: state.height, maximized: state.maximized }
}
