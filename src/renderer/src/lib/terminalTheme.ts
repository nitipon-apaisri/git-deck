// Maps the design tokens onto xterm's colour options. Pure: the caller passes a function
// that reads one CSS custom property, so tests need no DOM and no hex lives in components.

export interface TerminalColors {
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

/** The token behind each colour. Anything unreadable falls back to the text colour. */
export const TERMINAL_TOKENS: Record<keyof TerminalColors, string> = {
  background: '--island',
  foreground: '--text',
  cursor: '--accent',
  cursorAccent: '--island',
  selectionBackground: '--selection',
  black: '--window',
  red: '--danger',
  green: '--success',
  yellow: '--warning-text',
  blue: '--accent',
  magenta: '--lane-3',
  cyan: '--lane-2',
  white: '--text',
  brightBlack: '--text-muted',
  brightRed: '--danger',
  brightGreen: '--success-text',
  brightYellow: '--warning-text',
  brightBlue: '--accent-text',
  brightMagenta: '--lane-3',
  brightCyan: '--lane-2',
  brightWhite: '--text'
}

export function terminalColors(read: (token: string) => string): TerminalColors {
  const fallback = read('--text').trim()
  const out = {} as TerminalColors
  for (const key of Object.keys(TERMINAL_TOKENS) as (keyof TerminalColors)[]) {
    out[key] = read(TERMINAL_TOKENS[key]).trim() || fallback
  }
  return out
}
