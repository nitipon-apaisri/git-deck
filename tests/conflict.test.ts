import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyResolutions,
  ConflictParseError,
  conflictActions,
  conflictKindOf,
  hasMarkers,
  parseConflicts,
  regionsOf,
  sideLabels
} from '../src/shared/conflict'

const one = ['a', '<<<<<<< HEAD', 'mine', '=======', 'yours', '>>>>>>> feature', 'z', ''].join('\n')

test('conflictKindOf maps every unmerged XY and rejects the rest', () => {
  assert.equal(conflictKindOf('UU'), 'both-modified')
  assert.equal(conflictKindOf('AA'), 'both-added')
  assert.equal(conflictKindOf('DU'), 'deleted-by-us')
  assert.equal(conflictKindOf('UD'), 'deleted-by-them')
  assert.equal(conflictKindOf('AU'), 'added-by-us')
  assert.equal(conflictKindOf('UA'), 'added-by-them')
  assert.equal(conflictKindOf('DD'), 'both-deleted')
  assert.equal(conflictKindOf('MM'), null)
})

test('actions and markers depend on the kind', () => {
  assert.deepEqual(conflictActions('both-modified'), ['ours', 'theirs', 'mark-resolved'])
  assert.deepEqual(conflictActions('both-added'), ['ours', 'theirs', 'mark-resolved'])
  assert.deepEqual(conflictActions('deleted-by-them'), ['keep', 'delete'])
  assert.deepEqual(conflictActions('both-deleted'), ['delete'])
  assert.equal(hasMarkers('both-modified'), true)
  assert.equal(hasMarkers('deleted-by-us'), false)
})

test('sideLabels swap in a rebase and name the stash without an operation', () => {
  assert.deepEqual(sideLabels('merge'), { ours: 'Current', theirs: 'Incoming' })
  assert.deepEqual(sideLabels('cherry-pick'), { ours: 'Current', theirs: 'Incoming' })
  assert.deepEqual(sideLabels('revert'), { ours: 'Current', theirs: 'Incoming' })
  assert.deepEqual(sideLabels('rebase'), { ours: 'Upstream', theirs: 'Your commit' })
  assert.deepEqual(sideLabels(null), { ours: 'Current', theirs: 'Stash' })
})

test('parses one region with its labels and the text around it', () => {
  const parsed = parseConflicts(one)
  assert.equal(parsed.eol, '\n')
  assert.equal(parsed.finalNewline, true)
  assert.equal(parsed.segments.length, 3)
  const [region] = regionsOf(parsed)
  assert.deepEqual(region.ours, ['mine'])
  assert.deepEqual(region.theirs, ['yours'])
  assert.equal(region.base, null)
  assert.equal(region.oursLabel, 'HEAD')
  assert.equal(region.theirsLabel, 'feature')
})

test('parses diff3 and zdiff3 regions with their common ancestor', () => {
  const text = [
    '<<<<<<< HEAD',
    'mine',
    '||||||| merged common ancestors',
    'old',
    '=======',
    'yours',
    '>>>>>>> feature',
    ''
  ].join('\n')
  const [region] = regionsOf(parseConflicts(text))
  assert.deepEqual(region.base, ['old'])
  assert.equal(region.baseLabel, 'merged common ancestors')
  assert.equal(applyResolutions(parseConflicts(text), ['base']), 'old\n')
})

test('parses several regions and an empty side', () => {
  const text = [
    '<<<<<<< HEAD',
    '=======',
    'x',
    '>>>>>>> b',
    'mid',
    '<<<<<<< HEAD',
    'y',
    '=======',
    '>>>>>>> b',
    ''
  ].join('\n')
  const parsed = parseConflicts(text)
  const regions = regionsOf(parsed)
  assert.equal(regions.length, 2)
  assert.deepEqual(regions[0].ours, [])
  assert.deepEqual(regions[1].theirs, [])
  assert.equal(applyResolutions(parsed, ['both', 'both']), 'x\nmid\ny\n')
})

test('every choice builds the text', () => {
  const parsed = parseConflicts(one)
  assert.equal(applyResolutions(parsed, ['ours']), 'a\nmine\nz\n')
  assert.equal(applyResolutions(parsed, ['theirs']), 'a\nyours\nz\n')
  assert.equal(applyResolutions(parsed, ['both']), 'a\nmine\nyours\nz\n')
  assert.equal(applyResolutions(parsed, [{ text: 'new\nlines\n' }]), 'a\nnew\nlines\nz\n')
  assert.equal(applyResolutions(parsed, [{ text: '' }]), 'a\nz\n')
  assert.throws(() => applyResolutions(parsed, ['base']), /no common ancestor/)
})

test('a region left open is written back as it was read', () => {
  const parsed = parseConflicts(one)
  assert.equal(applyResolutions(parsed, [null]), one)
  const diff3 = '<<<<<<< HEAD\nm\n||||||| anc\no\n=======\nt\n>>>>>>> f\n'
  assert.equal(applyResolutions(parseConflicts(diff3), [null]), diff3)
})

test('the number of choices must match the number of regions', () => {
  const parsed = parseConflicts(one)
  assert.throws(() => applyResolutions(parsed, []), ConflictParseError)
  assert.throws(() => applyResolutions(parsed, ['ours', 'ours']), ConflictParseError)
})

test('CRLF is kept, and edited text takes the file line ending', () => {
  const text = one.replaceAll('\n', '\r\n')
  const parsed = parseConflicts(text)
  assert.equal(parsed.eol, '\r\n')
  assert.equal(applyResolutions(parsed, [null]), text)
  assert.equal(applyResolutions(parsed, ['ours']), 'a\r\nmine\r\nz\r\n')
  assert.equal(applyResolutions(parsed, [{ text: 'x\ny\n' }]), 'a\r\nx\r\ny\r\nz\r\n')
})

test('a mixed-ending file is written back byte for byte', () => {
  const text = 'a\r\n<<<<<<< HEAD\nmine\r\n=======\nyours\n>>>>>>> f\r\nz\n'
  assert.equal(applyResolutions(parseConflicts(text), [null]), text)
})

test('a missing final newline is kept', () => {
  const text = '<<<<<<< HEAD\nm\n=======\nt\n>>>>>>> f\ntail'
  const parsed = parseConflicts(text)
  assert.equal(parsed.finalNewline, false)
  assert.equal(applyResolutions(parsed, ['ours']), 'm\ntail')
  assert.equal(parseConflicts('').segments.length, 0)
  assert.equal(applyResolutions(parseConflicts(''), []), '')
})

test('text that only looks like a marker stays text', () => {
  const text = ['<<<<<<<< eight', '======== eight', ' <<<<<<< indented', '=======', 'ok', ''].join(
    '\n'
  )
  const parsed = parseConflicts(text)
  assert.equal(regionsOf(parsed).length, 0)
  assert.equal(applyResolutions(parsed, []), text)
})

test('odd files are refused instead of guessed at', () => {
  const nested = '<<<<<<< a\n<<<<<<< b\n=======\nx\n>>>>>>> c\n'
  assert.throws(() => parseConflicts(nested), /inside a conflict/)
  assert.throws(() => parseConflicts('<<<<<<< a\nx\n=======\ny\n'), /never closed/)
  assert.throws(() => parseConflicts('x\n>>>>>>> a\n'), /outside a conflict/)
  assert.throws(
    () => parseConflicts('<<<<<<< a\nx\n=======\ny\n=======\nz\n>>>>>>> b\n'),
    /second =======/
  )
  assert.throws(() => parseConflicts('<<<<<<< a\nx\n>>>>>>> b\n'), /ends before/)
})

test('edited text is size capped', () => {
  const parsed = parseConflicts(one)
  assert.throws(
    () => applyResolutions(parsed, [{ text: 'x'.repeat(1024 * 1024 + 1) }]),
    /not valid/
  )
})
