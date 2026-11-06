import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  actionHelp,
  actionLabel,
  blockText,
  canFinish,
  canSaveDraft,
  chooseAll,
  choiceText,
  conflictKindSentence,
  conflictKindText,
  countLines,
  displayLine,
  editStart,
  emptyChoices,
  openCount,
  previewText,
  quickAction,
  progressText,
  regionLines,
  regionsIn,
  resultOf,
  savedText,
  sideTitle,
  sidesHint,
  unsupportedText
} from '../src/renderer/src/lib/conflictView'
import { parseConflicts, sideLabels } from '../src/shared/conflict'
import type { ConflictFile, ConflictKind } from '../src/shared/types'

const text = [
  'top',
  '<<<<<<< HEAD',
  'mine',
  '=======',
  'yours',
  'more yours',
  '>>>>>>> feature',
  'mid',
  '<<<<<<< HEAD',
  'a',
  '=======',
  'b',
  '>>>>>>> feature',
  ''
].join('\n')

function fileOf(source = text): ConflictFile {
  const parsed = parseConflicts(source)
  return {
    path: 'f.txt',
    kind: 'both-modified',
    unsupported: null,
    detail: null,
    eol: parsed.eol,
    finalNewline: parsed.finalNewline,
    segments: parsed.segments,
    fingerprint: 'a'.repeat(40),
    actions: ['ours', 'theirs', 'mark-resolved'],
    operation: 'merge',
    labels: sideLabels('merge')
  }
}

const labels = sideLabels('merge')

test('every kind has words, and the sentence names the sides', () => {
  const kinds: ConflictKind[] = [
    'both-modified',
    'both-added',
    'deleted-by-us',
    'deleted-by-them',
    'added-by-us',
    'added-by-them',
    'both-deleted'
  ]
  for (const kind of kinds) {
    assert.ok(conflictKindText(kind).length > 0, kind)
    assert.ok(conflictKindSentence(kind, labels).length > 0, kind)
  }
  assert.equal(conflictKindText('both-modified'), 'both modified')
  assert.equal(
    conflictKindSentence('deleted-by-us', labels),
    'Current deleted this file, and Incoming changed it.'
  )
  assert.equal(
    conflictKindSentence('deleted-by-them', labels),
    'Incoming deleted this file, and Current changed it.'
  )
})

test('the sides hint follows the operation, and a rebase swaps the meaning', () => {
  assert.match(sidesHint('merge', labels), /Incoming is the branch being merged in/)
  assert.match(
    sidesHint('rebase', sideLabels('rebase')),
    /Upstream is the branch you are rebasing onto\. Your commit is the commit being replayed/
  )
  assert.match(sidesHint(null, sideLabels(null)), /Stash is the stashed change/)
})

test('whole-file buttons are named after the sides and say what they do', () => {
  assert.equal(actionLabel('ours', labels), 'Use Current')
  assert.equal(actionLabel('theirs', sideLabels('rebase')), 'Use Your commit')
  assert.equal(actionLabel('keep', labels), 'Keep the file')
  assert.equal(actionLabel('delete', labels), 'Delete the file')
  assert.equal(actionLabel('mark-resolved', labels), 'Mark as resolved')
  assert.match(actionHelp('delete', labels), /asks first/)
  assert.match(actionHelp('ours', labels), /Current/)
})

test('each reason a file has no regions has a sentence', () => {
  for (const reason of [
    'whole-file',
    'binary',
    'too-large',
    'submodule',
    'symlink',
    'unparseable'
  ] as const) {
    assert.ok(unsupportedText(reason, null).length > 10, reason)
  }
  assert.match(unsupportedText('unparseable', 'Line 3: x'), /\(Line 3: x\)/)
})

test('line counts and display lines', () => {
  assert.equal(countLines(1), '1 line')
  assert.equal(countLines(0), '0 lines')
  assert.equal(displayLine('abc\r'), 'abc')
  assert.equal(displayLine('abc'), 'abc')
  assert.equal(blockText(['a\r', 'b']), 'a\nb')
  assert.equal(sideTitle('Current', 'HEAD'), 'Current · HEAD')
  assert.equal(sideTitle('Current', ''), 'Current')
  assert.equal(sideTitle('Current', 'Current'), 'Current')
})

test('choices start open and progress is counted in words', () => {
  const file = fileOf()
  assert.equal(regionsIn(file).length, 2)
  const choices = emptyChoices(file)
  assert.deepEqual(choices, [null, null])
  assert.equal(openCount(choices), 2)
  assert.equal(progressText(choices), '0 of 2 conflicts resolved')
  assert.equal(progressText(['ours', null]), '1 of 2 conflicts resolved')
  assert.equal(progressText(['ours']), '1 of 1 conflict resolved')
  assert.equal(progressText([]), 'No conflicts left in this file')
})

test('Save and mark resolved needs every region, Save for later needs one', () => {
  assert.equal(canFinish([null, null]), false)
  assert.equal(canFinish(['ours', null]), false)
  assert.equal(canFinish(['ours', 'theirs']), true)
  assert.equal(canFinish([]), true)
  assert.equal(canSaveDraft([null, null]), false)
  assert.equal(canSaveDraft(['ours', null]), true)
  assert.equal(canSaveDraft([]), false)
})

test('a choice is named in words', () => {
  assert.equal(choiceText(null, labels), 'Not resolved')
  assert.equal(choiceText('ours', labels), 'Using Current')
  assert.equal(choiceText('theirs', labels), 'Using Incoming')
  assert.equal(choiceText('both', labels), 'Using Current, then Incoming')
  assert.equal(choiceText('base', labels), 'Using the common ancestor')
  assert.equal(choiceText({ text: 'x' }, labels), 'Edited by hand')
})

test('resultOf and editStart show what a region would hold', () => {
  const [first] = regionsIn(fileOf())
  assert.equal(resultOf(first, null, '\n'), null)
  assert.equal(resultOf(first, 'ours', '\n'), 'mine')
  assert.equal(resultOf(first, 'theirs', '\n'), 'yours\nmore yours')
  assert.equal(resultOf(first, 'both', '\n'), 'mine\nyours\nmore yours')
  assert.equal(resultOf(first, { text: 'x\ny\n' }, '\n'), 'x\ny')
  assert.equal(resultOf(first, { text: '' }, '\n'), '')
  assert.equal(editStart(first, null, '\n'), 'mine\nyours\nmore yours')
  assert.equal(editStart(first, 'ours', '\n'), 'mine')
})

test('CRLF lines show without the carriage return', () => {
  const file = fileOf(text.replaceAll('\n', '\r\n'))
  const [first] = regionsIn(file)
  assert.equal(resultOf(first, 'both', '\r\n'), 'mine\nyours\nmore yours')
})

test('the preview keeps open regions and fills in resolved ones', () => {
  const file = fileOf()
  assert.equal(previewText(file, [null, null]), text)
  assert.equal(previewText(file, ['ours', { text: 'x\n' }]), 'top\nmine\nmid\nx\n')
  assert.equal(
    previewText(file, [null, 'theirs']),
    [
      'top',
      '<<<<<<< HEAD',
      'mine',
      '=======',
      'yours',
      'more yours',
      '>>>>>>> feature',
      'mid',
      'b',
      ''
    ].join('\n')
  )
})

test('All Current and All Incoming choose every region', () => {
  const file = fileOf()
  assert.deepEqual(chooseAll(file, 'ours'), ['ours', 'ours'])
  assert.deepEqual(chooseAll(file, 'theirs'), ['theirs', 'theirs'])
  assert.deepEqual(chooseAll({ ...file, segments: null }, 'ours'), [])
})

test('the line after a save says what happened', () => {
  assert.equal(
    savedText({ staged: true, open: 0, fingerprint: 'x' }),
    'Saved and marked as resolved.'
  )
  assert.equal(
    savedText({ staged: false, open: 1, fingerprint: 'x' }),
    'Saved. 1 conflict is still open.'
  )
  assert.equal(
    savedText({ staged: false, open: 3, fingerprint: 'x' }),
    'Saved. 3 conflicts are still open.'
  )
  assert.match(
    savedText({ staged: false, open: 0, fingerprint: 'x' }),
    /looks like a conflict marker/
  )
})

test('region line numbers match the file as read', () => {
  // 1 top, 2 <<<<<<<, 3 mine, 4 =======, 5-6 yours, 7 >>>>>>>, 8 mid, 9 <<<<<<<, 10 a, 11 =======, 12 b
  assert.deepEqual(regionLines(fileOf()), [
    { marker: 2, ours: 3, base: null, theirs: 5 },
    { marker: 9, ours: 10, base: null, theirs: 12 }
  ])
  const diff3 = fileOf('x\n<<<<<<< HEAD\nm\n||||||| anc\no1\no2\n=======\nt\n>>>>>>> f\n')
  assert.deepEqual(regionLines(diff3), [{ marker: 2, ours: 3, base: 5, theirs: 8 }])
  assert.deepEqual(regionLines({ ...fileOf(), segments: null }), [])
})

test('the quick resolve button never stages a file that may still hold markers', () => {
  assert.equal(quickAction('both-modified'), 'mark-resolved')
  assert.equal(quickAction('both-added'), 'mark-resolved')
  assert.equal(quickAction('deleted-by-us'), 'keep')
  assert.equal(quickAction('deleted-by-them'), 'keep')
  assert.equal(quickAction('added-by-us'), 'keep')
  assert.equal(quickAction('added-by-them'), 'keep')
  assert.equal(quickAction('both-deleted'), 'delete')
  assert.equal(quickAction(null), 'keep')
})
