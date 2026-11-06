// Merge-conflict helpers. Pure, so tests run them directly and the renderer can preview a result.
import type {
  ConflictAction,
  ConflictChoice,
  ConflictKind,
  ConflictRegion,
  ConflictSegment,
  OperationKind,
  SideLabels
} from './types'

/** Files bigger than this are not parsed into regions. */
export const MAX_CONFLICT_BYTES = 2 * 1024 * 1024
/** The most text one edited region may hold. */
export const MAX_REGION_TEXT = 1024 * 1024

const KIND_BY_XY: Record<string, ConflictKind> = {
  UU: 'both-modified',
  AA: 'both-added',
  DU: 'deleted-by-us',
  UD: 'deleted-by-them',
  AU: 'added-by-us',
  UA: 'added-by-them',
  DD: 'both-deleted'
}

/** The conflict kind of the `XY` field of a porcelain v2 `u` line, `null` when unknown. */
export function conflictKindOf(xy: string): ConflictKind | null {
  return KIND_BY_XY[xy] ?? null
}

/** What can be done to the whole file. Only some kinds ever have markers to edit. */
export function conflictActions(kind: ConflictKind): ConflictAction[] {
  switch (kind) {
    case 'both-modified':
    case 'both-added':
      return ['ours', 'theirs', 'mark-resolved']
    case 'both-deleted':
      return ['delete']
    default:
      return ['keep', 'delete']
  }
}

/** Kinds that leave `<<<<<<<` markers in the file. */
export function hasMarkers(kind: ConflictKind): boolean {
  return kind === 'both-modified' || kind === 'both-added'
}

/**
 * Which side is which. A rebase replays your commits on top of the target, so git's "ours" is
 * the branch you rebase onto and "theirs" is your commit. Everywhere else it is the other way round.
 * With no operation the only source is a stash that was applied.
 */
export function sideLabels(operation: OperationKind | null): SideLabels {
  if (operation === 'rebase') return { ours: 'Upstream', theirs: 'Your commit' }
  if (operation === null) return { ours: 'Current', theirs: 'Stash' }
  return { ours: 'Current', theirs: 'Incoming' }
}

export class ConflictParseError extends Error {}

const START = /^<{7}(?: ([\s\S]*))?$/
const BASE = /^\|{7}(?: ([\s\S]*))?$/
const SEP = /^={7}$/
const END = /^>{7}(?: ([\s\S]*))?$/

const bare = (line: string): string => (line.endsWith('\r') ? line.slice(0, -1) : line)

export interface ParsedConflicts {
  /** The dominant line ending. Lines keep their own `\r`, so a mixed file is written back as read. */
  eol: '\n' | '\r\n'
  /** The text ended with a newline. */
  finalNewline: boolean
  segments: ConflictSegment[]
}

/**
 * Splits a conflicted file into plain text and conflict regions. The default, `diff3` and
 * `zdiff3` marker styles are understood. Anything odd (a nested or unterminated block, a stray
 * marker, a second `=======`) throws a `ConflictParseError` instead of being guessed at.
 */
export function parseConflicts(text: string): ParsedConflicts {
  const finalNewline = text.endsWith('\n')
  const lines = text === '' ? [] : text.split('\n')
  if (finalNewline) lines.pop()
  const lf = (text.match(/\n/g) ?? []).length
  const crlf = (text.match(/\r\n/g) ?? []).length
  const eol = crlf > 0 && crlf * 2 >= lf ? '\r\n' : '\n'

  const segments: ConflictSegment[] = []
  let plain: string[] = []
  let region: ConflictRegion | null = null
  let part: 'ours' | 'base' | 'theirs' = 'ours'
  let startedAt = 0

  const fail = (n: number, what: string): never => {
    throw new ConflictParseError(`Line ${n + 1}: ${what}`)
  }

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]
    const marker = bare(line)
    if (!region) {
      const start = START.exec(marker)
      if (start) {
        if (plain.length > 0) segments.push({ type: 'text', lines: plain })
        plain = []
        startedAt = n
        part = 'ours'
        region = {
          type: 'conflict',
          ours: [],
          base: null,
          theirs: [],
          oursLabel: start[1] ?? '',
          baseLabel: null,
          theirsLabel: '',
          marks: { start: line, base: null, sep: '', end: '' }
        }
      } else if (BASE.test(marker) || END.test(marker)) {
        fail(n, 'a conflict marker outside a conflict')
      } else {
        plain.push(line)
      }
      continue
    }
    if (START.test(marker)) fail(n, 'a conflict inside a conflict')
    const base = BASE.exec(marker)
    if (base) {
      if (part !== 'ours') fail(n, 'unexpected base marker')
      part = 'base'
      region.base = []
      region.baseLabel = base[1] ?? ''
      region.marks.base = line
    } else if (SEP.test(marker)) {
      if (part === 'theirs') fail(n, 'a second ======= in one conflict')
      part = 'theirs'
      region.marks.sep = line
    } else {
      const end = END.exec(marker)
      if (end) {
        if (part !== 'theirs') fail(n, 'the conflict ends before its ======= line')
        region.theirsLabel = end[1] ?? ''
        region.marks.end = line
        segments.push(region)
        region = null
      } else if (part === 'ours') {
        region.ours.push(line)
      } else if (part === 'base') {
        region.base?.push(line)
      } else {
        region.theirs.push(line)
      }
    }
  }
  if (region) fail(startedAt, 'the conflict is never closed')
  if (plain.length > 0) segments.push({ type: 'text', lines: plain })
  return { eol, finalNewline, segments }
}

/** The regions in file order. A choice array has one entry per region, in this order. */
export function regionsOf(parsed: ParsedConflicts): ConflictRegion[] {
  return parsed.segments.filter((s): s is ConflictRegion => s.type === 'conflict')
}

/** The lines of an edited region, with the file's line ending. */
function textLines(text: string, eol: '\n' | '\r\n'): string[] {
  if (text === '') return []
  const lines = text.split(/\r?\n/)
  if (text.endsWith('\n')) lines.pop()
  return eol === '\r\n' ? lines.map((l) => `${l}\r`) : lines
}

/** The lines a choice puts in place of a region. */
export function chosenLines(
  region: ConflictRegion,
  choice: Exclude<ConflictChoice, null>,
  eol: '\n' | '\r\n'
): string[] {
  if (typeof choice === 'object') {
    if (typeof choice.text !== 'string' || choice.text.length > MAX_REGION_TEXT) {
      throw new ConflictParseError('The edited text is not valid')
    }
    return textLines(choice.text, eol)
  }
  switch (choice) {
    case 'ours':
      return region.ours
    case 'theirs':
      return region.theirs
    case 'both':
      return [...region.ours, ...region.theirs]
    case 'base':
      if (!region.base) throw new ConflictParseError('This conflict has no common ancestor')
      return region.base
    default:
      throw new ConflictParseError('Unknown choice')
  }
}

/** The region as it was read, markers included. */
function reopened(region: ConflictRegion): string[] {
  const { marks } = region
  return [
    marks.start,
    ...region.ours,
    ...(marks.base !== null ? [marks.base, ...(region.base ?? [])] : []),
    marks.sep,
    ...region.theirs,
    marks.end
  ]
}

/**
 * Builds the file text. `choices` has one entry per region in file order; `null` leaves a region
 * open, markers and all, so a half-done file can be saved.
 */
export function applyResolutions(parsed: ParsedConflicts, choices: ConflictChoice[]): string {
  const regions = regionsOf(parsed)
  if (choices.length !== regions.length) {
    throw new ConflictParseError(
      `Expected a choice for each of the ${regions.length} conflicts, got ${choices.length}`
    )
  }
  const out: string[] = []
  let next = 0
  for (const segment of parsed.segments) {
    if (segment.type === 'text') {
      out.push(...segment.lines)
      continue
    }
    const choice = choices[next++]
    out.push(...(choice === null ? reopened(segment) : chosenLines(segment, choice, parsed.eol)))
  }
  return out.join('\n') + (parsed.finalNewline && out.length > 0 ? '\n' : '')
}
