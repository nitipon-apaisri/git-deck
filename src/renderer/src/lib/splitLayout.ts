// Pure geometry and key mapping for Split View. No DOM, so it runs under tsx tests.
import { RATIO_MAX, RATIO_MIN, RATIO_STEP, type Orientation } from './splitState'

/** Smallest pane, side by side and stacked. */
export const MIN_PANE_WIDTH = 360
export const MIN_PANE_HEIGHT = 240
/** The divider track, `--divider-width`. */
export const DIVIDER = 12
/** Under this width a pane switches to its compact layout. */
export const NARROW_PANE = 640

export const minPane = (orientation: Orientation): number =>
  orientation === 'horizontal' ? MIN_PANE_WIDTH : MIN_PANE_HEIGHT

/**
 * Side by side needs room for two panes and the divider. When the area is narrower the
 * panes stack, and the saved orientation is left alone so it returns with the room.
 * A width of 0 means "not measured yet".
 */
export function effectiveOrientation(saved: Orientation, width: number): Orientation {
  if (saved === 'vertical' || width <= 0) return saved
  return width < 2 * MIN_PANE_WIDTH + DIVIDER ? 'vertical' : 'horizontal'
}

/**
 * Keeps pane 0 between 25 % and 75 % and also no smaller than `min` px on either side.
 * `extent` is the area along the divider's axis, divider included.
 */
export function fitRatio(ratio: number, extent: number, min: number): number {
  const space = extent - DIVIDER
  if (!Number.isFinite(ratio)) return 0.5
  let low = RATIO_MIN
  let high = RATIO_MAX
  if (space > 0) {
    low = Math.max(low, min / space)
    high = Math.min(high, 1 - min / space)
  }
  // Not enough room for both minimums: split evenly.
  if (low > high) return 0.5
  return Math.min(high, Math.max(low, ratio))
}

/** The ratio for a pointer at `pointer` px, where the area starts at `start`. */
export function ratioFromPointer(
  pointer: number,
  start: number,
  extent: number,
  min: number
): number {
  const space = extent - DIVIDER
  if (space <= 0) return 0.5
  return fitRatio((pointer - start - DIVIDER / 2) / space, extent, min)
}

/** One arrow key press: `direction` is -1 or 1. */
export function nudgeRatio(ratio: number, direction: -1 | 1): number {
  return Math.round((ratio + direction * RATIO_STEP) * 100) / 100
}

/** CSS track list for the two panes and the divider. */
export function trackTemplate(ratio: number, orientation: Orientation): string {
  const first = Math.round(ratio * 1000)
  const second = 1000 - first
  const min = minPane(orientation)
  return `minmax(${min}px, ${first}fr) ${DIVIDER}px minmax(${min}px, ${second}fr)`
}

export const isNarrow = (width: number): boolean => width > 0 && width < NARROW_PANE

/** Split View and narrow panes have no room beside the graph, so the detail opens under it. */
export const detailPlacement = (split: boolean, narrow: boolean): 'side' | 'below' =>
  split || narrow ? 'below' : 'side'

export type ShortcutAction = 'toggle' | 'pane1' | 'pane2' | 'search'

export interface KeyLike {
  code: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

/**
 * Ctrl/Cmd+Alt+S toggles split view. Ctrl/Cmd+1 and +2 focus a pane. Ctrl/Cmd+K focuses
 * the sidebar search. `code` is used because Alt changes `key` on macOS ("ß" for Alt+S).
 */
export function shortcutOf(e: KeyLike): ShortcutAction | null {
  const mod = e.ctrlKey !== e.metaKey // exactly one of them
  if (!mod || e.shiftKey) return null
  if (e.altKey) return e.code === 'KeyS' ? 'toggle' : null
  if (e.code === 'KeyK') return 'search'
  if (e.code === 'Digit1') return 'pane1'
  if (e.code === 'Digit2') return 'pane2'
  return null
}
