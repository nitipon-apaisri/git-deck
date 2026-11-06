// Pure: the words and the arithmetic of the conflict editor, so tests run them without a DOM.
import { applyResolutions, regionsOf, type ParsedConflicts } from '../../../shared/conflict'
import type {
  ConflictAction,
  ConflictChoice,
  ConflictFile,
  ConflictKind,
  ConflictRegion,
  ConflictSaveResult,
  ConflictUnsupported,
  OperationKind,
  SideLabels
} from '../../../shared/types'

/** How the two sides disagree, in words, for the banner and the editor header. */
export function conflictKindText(kind: ConflictKind): string {
  switch (kind) {
    case 'both-modified':
      return 'both modified'
    case 'both-added':
      return 'both added'
    case 'deleted-by-us':
      return 'deleted on one side, changed on the other'
    case 'deleted-by-them':
      return 'changed on one side, deleted on the other'
    case 'added-by-us':
    case 'added-by-them':
      return 'added on one side only'
    case 'both-deleted':
      return 'deleted on both sides'
  }
}

/** The same, naming the sides: "Deleted on Current, changed on Incoming". */
export function conflictKindSentence(kind: ConflictKind, labels: SideLabels): string {
  const { ours, theirs } = labels
  switch (kind) {
    case 'both-modified':
      return `Both ${ours} and ${theirs} changed this file.`
    case 'both-added':
      return `Both ${ours} and ${theirs} added a file with this name.`
    case 'deleted-by-us':
      return `${ours} deleted this file, and ${theirs} changed it.`
    case 'deleted-by-them':
      return `${theirs} deleted this file, and ${ours} changed it.`
    case 'added-by-us':
      return `Only ${ours} has this file (it came from a rename).`
    case 'added-by-them':
      return `Only ${theirs} has this file (it came from a rename).`
    case 'both-deleted':
      return `Both ${ours} and ${theirs} deleted or renamed this file.`
  }
}

/** One line on what each side is, for the editor header. */
export function sidesHint(operation: OperationKind | null, labels: SideLabels): string {
  switch (operation) {
    case 'rebase':
      return `${labels.ours} is the branch you are rebasing onto. ${labels.theirs} is the commit being replayed.`
    case 'merge':
      return `${labels.ours} is the branch you are on. ${labels.theirs} is the branch being merged in.`
    case 'cherry-pick':
      return `${labels.ours} is the branch you are on. ${labels.theirs} is the commit being picked.`
    case 'revert':
      return `${labels.ours} is the branch you are on. ${labels.theirs} is the undoing of the commit.`
    default:
      return `${labels.ours} is what is in your branch. ${labels.theirs} is the stashed change.`
  }
}

/** Short names for the whole-file buttons. */
export function actionLabel(action: ConflictAction, labels: SideLabels): string {
  switch (action) {
    case 'ours':
      return `Use ${labels.ours}`
    case 'theirs':
      return `Use ${labels.theirs}`
    case 'keep':
      return 'Keep the file'
    case 'delete':
      return 'Delete the file'
    case 'mark-resolved':
      return 'Mark as resolved'
  }
}

/** What the button does, said plainly. Shown under the button. */
export function actionHelp(action: ConflictAction, labels: SideLabels): string {
  switch (action) {
    case 'ours':
      return `Take the whole file as ${labels.ours} has it.`
    case 'theirs':
      return `Take the whole file as ${labels.theirs} has it.`
    case 'keep':
      return 'Keep the file as it is on disk.'
    case 'delete':
      return 'Remove the file. This asks first.'
    case 'mark-resolved':
      return 'Stage the file as it is now. Use this after fixing it in another editor.'
  }
}

/** Why a file has no regions to pick from. */
export function unsupportedText(reason: ConflictUnsupported, detail: string | null): string {
  switch (reason) {
    case 'whole-file':
      return 'There are no conflict markers in this file. Choose what to do with the file as a whole.'
    case 'binary':
      return 'This is a binary file, or text that is not UTF-8, so it cannot be merged line by line.'
    case 'too-large':
      return 'This file is too large to merge here.'
    case 'submodule':
      return 'This is a submodule. Resolve it with git in a terminal.'
    case 'symlink':
      return 'This is a symbolic link, or sits behind one, so it is not opened here.'
    case 'unparseable':
      return `The conflict markers could not be read safely${detail ? ` (${detail})` : ''}. Fix the file in another editor, then mark it as resolved.`
  }
}

export const countLines = (n: number): string => `${n} ${n === 1 ? 'line' : 'lines'}`

/** A line as shown: the `\r` of a CRLF file is not text. */
export const displayLine = (line: string): string =>
  line.endsWith('\r') ? line.slice(0, -1) : line

/** The lines of one side as one block of text. */
export function blockText(lines: string[]): string {
  return lines.map(displayLine).join('\n')
}

/** "Current" with the branch git wrote in the marker: "Current · HEAD". */
export function sideTitle(label: string, marker: string): string {
  return marker && marker !== label ? `${label} · ${marker}` : label
}

export function emptyChoices(file: ConflictFile): ConflictChoice[] {
  return regionsIn(file).map(() => null)
}

export function regionsIn(file: ConflictFile): ConflictRegion[] {
  return file.segments ? regionsOf(parsedOf(file)) : []
}

/** The parsed form `applyResolutions` wants, rebuilt from what main sent. */
export function parsedOf(file: ConflictFile): ParsedConflicts {
  return {
    eol: file.eol ?? '\n',
    finalNewline: file.finalNewline,
    segments: file.segments ?? []
  }
}

export const openCount = (choices: ConflictChoice[]): number =>
  choices.filter((c) => c === null).length

export const resolvedCount = (choices: ConflictChoice[]): number =>
  choices.length - openCount(choices)

/** "2 of 3 conflicts resolved". */
export function progressText(choices: ConflictChoice[]): string {
  const total = choices.length
  if (total === 0) return 'No conflicts left in this file'
  const done = resolvedCount(choices)
  return `${done} of ${total} ${total === 1 ? 'conflict' : 'conflicts'} resolved`
}

/** What a choice is called on the card. */
export function choiceText(choice: ConflictChoice, labels: SideLabels): string {
  if (choice === null) return 'Not resolved'
  if (typeof choice === 'object') return 'Edited by hand'
  switch (choice) {
    case 'ours':
      return `Using ${labels.ours}`
    case 'theirs':
      return `Using ${labels.theirs}`
    case 'both':
      return `Using ${labels.ours}, then ${labels.theirs}`
    case 'base':
      return 'Using the common ancestor'
  }
}

/** The lines a choice puts in a region, as text. `null` for an open region. */
export function resultOf(
  region: ConflictRegion,
  choice: ConflictChoice,
  eol: '\n' | '\r\n'
): string | null {
  if (choice === null) return null
  const regionOnly: ParsedConflicts = { eol, finalNewline: true, segments: [region] }
  return blockText(applyResolutions(regionOnly, [choice]).split('\n').slice(0, -1))
}

/** The whole file as it would be written. Open regions keep their markers. */
export function previewText(file: ConflictFile, choices: ConflictChoice[]): string {
  return applyResolutions(parsedOf(file), choices)
}

/** The text an Edit box starts with: what the region holds now, else both sides. */
export function editStart(
  region: ConflictRegion,
  choice: ConflictChoice,
  eol: '\n' | '\r\n'
): string {
  return resultOf(region, choice ?? 'both', eol) ?? ''
}

/** Save and mark resolved needs a choice for every region. */
export const canFinish = (choices: ConflictChoice[]): boolean => openCount(choices) === 0

/** Save for later needs at least one choice, so there is something to keep. */
export const canSaveDraft = (choices: ConflictChoice[]): boolean =>
  choices.length > 0 && resolvedCount(choices) > 0

/** The line under the footer after a save. */
export function savedText(result: ConflictSaveResult): string {
  if (result.staged) return 'Saved and marked as resolved.'
  if (result.open > 0) {
    return `Saved. ${result.open} ${result.open === 1 ? 'conflict is' : 'conflicts are'} still open.`
  }
  return 'Saved, but the file still has a line that looks like a conflict marker, so it was not marked as resolved.'
}

/** Sets every region to the same choice. */
export const chooseAll = (file: ConflictFile, choice: 'ours' | 'theirs'): ConflictChoice[] =>
  regionsIn(file).map(() => choice)

/** Where a region sits in the file as read: 1-based line numbers of the first line of each part. */
export interface RegionLines {
  /** The `<<<<<<<` line. */
  marker: number
  ours: number
  base: number | null
  theirs: number
}

/** Line numbers per region, so the editor can point to the same lines another editor shows. */
export function regionLines(file: ConflictFile): RegionLines[] {
  const found: RegionLines[] = []
  let line = 1
  for (const segment of file.segments ?? []) {
    if (segment.type === 'text') {
      line += segment.lines.length
      continue
    }
    const marker = line
    const ours = marker + 1
    let next = ours + segment.ours.length
    let base: number | null = null
    if (segment.base) {
      base = next + 1
      next = base + segment.base.length
    }
    const theirs = next + 1
    found.push({ marker, ours, base, theirs })
    line = theirs + segment.theirs.length + 1
  }
  return found
}

/**
 * What the quick "mark as resolved" button does for a file. A file with markers is checked first
 * (main refuses one that still has them). A delete-versus-modify file is kept as it is on disk,
 * and a file deleted on both sides is deleted.
 */
export function quickAction(kind: ConflictKind | null): ConflictAction {
  if (kind === 'both-modified' || kind === 'both-added') return 'mark-resolved'
  if (kind === 'both-deleted') return 'delete'
  return 'keep'
}
